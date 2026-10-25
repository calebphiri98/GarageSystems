<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/auth.php';

/**
 * GET /reports/overview?from=YYYY-MM-DD&to=YYYY-MM-DD   (admin only)
 *
 * One call that returns a summary of the whole system.
 * - Date range applies to: sales, revenue, invoices, orders, jobs, appointments.
 * - Always "right now" (ignores the range): stock levels and unpaid invoices.
 */
class AdminReportController
{
    private static function validDate(string $d): bool
    {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) {
            return false;
        }
        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }

    /** SQL fragment for "column falls inside the range". $k keeps parameter names unique. */
    private static function between(string $col, string $k, string $from, string $to, array &$params): string
    {
        $params[":f$k"] = $from;
        $params[":t$k"] = $to;
        return "$col >= CAST(:f$k AS date) AND $col < (CAST(:t$k AS date) + INTERVAL '1 day')";
    }

    private static function rows(PDO $db, string $sql, array $params = []): array
    {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private static function statusCounts(PDO $db, string $table, string $dateCol, string $from, string $to): array
    {
        $p = [];
        $where = self::between($dateCol, 's', $from, $to, $p);
        $rows = self::rows(
            $db,
            "SELECT status::text AS status, COUNT(*) AS count FROM $table WHERE $where GROUP BY status ORDER BY count DESC",
            $p
        );
        return array_map(fn($r) => ['status' => $r['status'], 'count' => (int) $r['count']], $rows);
    }

    public static function overview(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin']);

        $rawFrom = trim($_GET['from'] ?? '');
        $rawTo = trim($_GET['to'] ?? '');
        $from = $rawFrom !== '' ? $rawFrom : '1970-01-01';
        $to = $rawTo !== '' ? $rawTo : '2999-12-31';

        if (!self::validDate($from) || !self::validDate($to)) {
            Response::error('Dates must be in YYYY-MM-DD format.', 422);
        }
        if ($from > $to) {
            Response::error('The from date cannot be after the to date.', 422);
        }

        $db = Database::connect();

        // ---- Inventory (current) ----
        $inv = self::rows($db, "SELECT
                COUNT(*) AS products,
                COALESCE(SUM(quantity), 0) AS units,
                COALESCE(SUM(quantity * unit_price), 0) AS stock_value,
                COUNT(*) FILTER (WHERE quantity = 0) AS out_of_stock,
                COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= min_stock_level) AS low_stock
             FROM parts WHERE is_active = TRUE")[0];

        $products = self::rows($db, "SELECT id, name, sku, category, brand, quantity, min_stock_level, unit_price
             FROM parts WHERE is_active = TRUE ORDER BY name");

        // ---- Most sold products (orders + parts used on jobs, both with a PAID invoice) ----
        $p = [];
        $w1 = self::between('i.created_at', 'a', $from, $to, $p);
        $w2 = self::between('i.created_at', 'b', $from, $to, $p);
        $topSold = self::rows($db, "SELECT p.id, p.name, p.sku, SUM(s.qty) AS units, SUM(s.qty * s.price) AS revenue
             FROM (
                SELECT oi.part_id, oi.quantity AS qty, oi.unit_price AS price
                FROM order_items oi JOIN invoices i ON i.order_id = oi.order_id
                WHERE i.status::text = 'Paid' AND $w1
                UNION ALL
                SELECT jp.part_id, jp.quantity, jp.unit_price
                FROM job_parts jp JOIN invoices i ON i.job_id = jp.job_id
                WHERE i.status::text = 'Paid' AND $w2
             ) s
             JOIN parts p ON p.id = s.part_id
             GROUP BY p.id, p.name, p.sku
             ORDER BY units DESC, revenue DESC
             LIMIT 10", $p);

        // ---- Money in (payments inside the range) ----
        $p = [];
        $w = self::between('paid_at', 'p1', $from, $to, $p);
        $rev = self::rows($db, "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM payments WHERE $w", $p)[0];

        $p = [];
        $w = self::between('paid_at', 'p2', $from, $to, $p);
        $byMethod = self::rows($db, "SELECT COALESCE(method, 'Unknown') AS method, COUNT(*) AS count, SUM(amount) AS total
             FROM payments WHERE $w GROUP BY method ORDER BY total DESC", $p);

        // ---- Invoices created in the range, grouped by status ----
        $p = [];
        $w = self::between('created_at', 'i1', $from, $to, $p);
        $invByStatus = self::rows($db, "SELECT status::text AS status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
             FROM invoices WHERE $w GROUP BY status ORDER BY count DESC", $p);

        // ---- Unpaid / partially paid invoices (all time, current balance) ----
        $unpaid = self::rows($db, "SELECT i.id, i.invoice_number, i.status::text AS status, i.total, i.created_at,
                u.name AS customer, COALESCE(SUM(pay.amount), 0) AS paid
             FROM invoices i
             JOIN users u ON u.id = i.customer_id
             LEFT JOIN payments pay ON pay.invoice_id = i.id
             WHERE i.status::text IN ('Unpaid', 'Partially Paid')
             GROUP BY i.id, u.name
             ORDER BY i.created_at ASC
             LIMIT 200");

        $outstanding = 0.0;
        foreach ($unpaid as &$u) {
            $u['balance'] = round((float) $u['total'] - (float) $u['paid'], 2);
            $outstanding += $u['balance'];
        }
        unset($u);

        // ---- People ----
        $people = self::rows($db, "SELECT role::text AS role, COUNT(*) AS count FROM users
             WHERE is_active IS NOT FALSE GROUP BY role ORDER BY role");

        Response::success([
            'range' => ['from' => $rawFrom ?: null, 'to' => $rawTo ?: null],
            'generated_at' => date('c'),
            'inventory' => [
                'products' => (int) $inv['products'],
                'units' => (int) $inv['units'],
                'stock_value' => (float) $inv['stock_value'],
                'out_of_stock' => (int) $inv['out_of_stock'],
                'low_stock' => (int) $inv['low_stock'],
                'items' => $products,
            ],
            'top_sold' => $topSold,
            'revenue' => [
                'total' => (float) $rev['total'],
                'payments' => (int) $rev['count'],
                'by_method' => $byMethod,
            ],
            'invoices_by_status' => $invByStatus,
            'unpaid' => [
                'count' => count($unpaid),
                'outstanding' => round($outstanding, 2),
                'items' => $unpaid,
            ],
            'orders_by_status' => self::statusCounts($db, 'orders', 'created_at', $from, $to),
            'jobs_by_status' => self::statusCounts($db, 'job_cards', 'opened_at', $from, $to),
            'appointments_by_status' => self::statusCounts($db, 'appointments', 'created_at', $from, $to),
            'people' => $people,
        ]);
    }
}
