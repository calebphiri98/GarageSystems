<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/auth.php';

/**
 * GET /reports/manager?from=YYYY-MM-DD&to=YYYY-MM-DD   (manager only)
 *
 * Decision-support report. Deliberately narrow: it only returns the numbers a
 * manager acts on (cash to collect, work blocked, stock to buy, what sells).
 * Full system statistics stay in the admin report.
 *
 * - Date range applies to: money received, sales, invoices raised, jobs opened.
 * - Always "right now" (ignores the range): outstanding balances, approvals,
 *   stock levels, work in progress.
 */
class ManagerReportController
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

    private static function one(PDO $db, string $sql, array $params = []): array
    {
        $rows = self::rows($db, $sql, $params);
        return $rows[0] ?? [];
    }

    public static function overview(): void
    {
        $payload = require_auth();
        require_role($payload, ['manager']);

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

        // ---- 1. Cash: received in the period vs. still owed today ----
        $p = [];
        $w = self::between('paid_at', 'p1', $from, $to, $p);
        $received = self::one($db, "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM payments WHERE $w", $p);

        $p = [];
        $w = self::between('created_at', 'i1', $from, $to, $p);
        $raised = self::one($db, "SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
             FROM invoices WHERE status::text NOT IN ('Cancelled', 'Refunded') AND $w", $p);

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
        $overdue = 0.0;
        $overdueCount = 0;
        $oldestDays = 0;
        foreach ($unpaid as &$u) {
            $u['balance'] = round((float) $u['total'] - (float) $u['paid'], 2);
            $u['age_days'] = max(0, (int) floor((time() - strtotime($u['created_at'])) / 86400));
            $outstanding += $u['balance'];
            if ($u['age_days'] > 30) {
                $overdue += $u['balance'];
                $overdueCount++;
            }
            $oldestDays = max($oldestDays, $u['age_days']);
        }
        unset($u);

        // ---- 2. Work blocked: approvals waiting on the customer ----
        $approvals = self::one($db, "SELECT COUNT(*) AS count, COALESCE(SUM(ja.estimated_cost), 0) AS value
             FROM job_approvals ja
             JOIN job_cards j ON j.id = ja.job_id
             WHERE ja.status::text = 'Pending' AND j.status::text = 'Awaiting Approval'");

        $approvalItems = self::rows($db, "SELECT ja.id, ja.description, ja.estimated_cost, ja.requested_at,
                j.job_number, u.name AS customer
             FROM job_approvals ja
             JOIN job_cards j ON j.id = ja.job_id
             JOIN users u ON u.id = j.customer_id
             WHERE ja.status::text = 'Pending' AND j.status::text = 'Awaiting Approval'
             ORDER BY ja.requested_at ASC
             LIMIT 5");

        // ---- 3. Work in progress (today's position) ----
        $jobs = self::rows($db, "SELECT status::text AS status, COUNT(*) AS count
             FROM job_cards WHERE status::text <> 'Collected' GROUP BY status ORDER BY count DESC");
        $activeJobs = 0;
        $waitingParts = 0;
        $readyForCollection = 0;
        foreach ($jobs as $j) {
            $activeJobs += (int) $j['count'];
            if ($j['status'] === 'Waiting for Parts') {
                $waitingParts = (int) $j['count'];
            }
            if ($j['status'] === 'Ready for Collection') {
                $readyForCollection = (int) $j['count'];
            }
        }

        // ---- 4. Stock to buy (today's position) ----
        $stock = self::one($db, "SELECT
                COUNT(*) FILTER (WHERE quantity = 0) AS out_of_stock,
                COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= min_stock_level) AS low_stock,
                COALESCE(SUM(GREATEST(min_stock_level - quantity, 0) * unit_price), 0) AS restock_cost
             FROM parts");

        $reorder = self::rows($db, "SELECT id, name, sku, quantity, min_stock_level, unit_price,
                GREATEST(min_stock_level - quantity, 0) AS shortfall
             FROM parts
             WHERE quantity <= min_stock_level
             ORDER BY (quantity = 0) DESC, quantity ASC
             LIMIT 5");

        // ---- 5. What sells (paid sales in the period) ----
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
             ORDER BY revenue DESC
             LIMIT 5", $p);

        // ---- 6. Demand not yet served (today's position) ----
        $demand = self::one($db, "SELECT
                (SELECT COUNT(*) FROM appointments WHERE status::text = 'Pending') AS pending_appointments,
                (SELECT COUNT(*) FROM orders WHERE status::text = 'Pending') AS pending_orders");

        Response::success([
            'range' => ['from' => $rawFrom ?: null, 'to' => $rawTo ?: null],
            'generated_at' => date('c'),
            'cash' => [
                'received' => (float) $received['total'],
                'payments' => (int) $received['count'],
                'raised' => (float) $raised['total'],
                'invoices_raised' => (int) $raised['count'],
                'outstanding' => round($outstanding, 2),
                'unpaid_count' => count($unpaid),
                'overdue' => round($overdue, 2),
                'overdue_count' => $overdueCount,
                'oldest_days' => $oldestDays,
                'items' => array_slice($unpaid, 0, 5),
            ],
            'approvals' => [
                'count' => (int) $approvals['count'],
                'value' => (float) $approvals['value'],
                'items' => $approvalItems,
            ],
            'work' => [
                'active_jobs' => $activeJobs,
                'waiting_parts' => $waitingParts,
                'ready_for_collection' => $readyForCollection,
            ],
            'stock' => [
                'out_of_stock' => (int) $stock['out_of_stock'],
                'low_stock' => (int) $stock['low_stock'],
                'restock_cost' => (float) $stock['restock_cost'],
                'items' => $reorder,
            ],
            'top_sold' => $topSold,
            'demand' => [
                'pending_appointments' => (int) $demand['pending_appointments'],
                'pending_orders' => (int) $demand['pending_orders'],
            ],
        ]);
    }
}
