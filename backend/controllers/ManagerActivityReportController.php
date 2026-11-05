<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
if (!function_exists('require_auth')) {
    require_once __DIR__ . '/../middleware/auth.php';
}

/**
 * GET /reports/manager/activity?from=YYYY-MM-DD&to=YYYY-MM-DD   (manager only)
 *
 * The "what actually happened" report. Where ManagerReportController answers
 * "what needs a decision", this one answers "what did the business do":
 *
 *  1. completed_services - every job that reached Completed / Ready for
 *     Collection / Collected in the period, with the full activity recorded
 *     against it: mechanic, diagnosis, work performed, services charged,
 *     parts used, approvals, invoice and payments.
 *  2. cash - money actually received in the period, split by method and by
 *     where it came from (workshop jobs vs parts orders), plus what is still
 *     owed.
 *  3. top_sold - products ranked by units sold (descending), with revenue,
 *     profit and share of sales.
 *  4. analysis - the derived business numbers: average job value, labour vs
 *     parts mix, repeat customers, mechanic productivity, busiest services.
 *
 * Date range applies to: jobs completed, cash received, sales, invoices.
 * "Today" figures (outstanding, stock) ignore the range.
 */
class ManagerActivityReportController
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

    /** Group rows by a key column, keeping the row order. */
    private static function groupBy(array $rows, string $key): array
    {
        $out = [];
        foreach ($rows as $row) {
            $out[$row[$key]][] = $row;
        }
        return $out;
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

        // =========================================================
        // 1. COMPLETED SERVICES + everything that happened on them
        // =========================================================
        $p = [];
        $w = self::between('j.closed_at', 'c1', $from, $to, $p);
        $jobs = self::rows($db, "SELECT j.id, j.job_number, j.status::text AS status,
                j.reported_problem, j.diagnosis, j.work_performed, j.completion_notes,
                j.opened_at, j.closed_at,
                c.name AS customer, c.phone AS customer_phone,
                v.make, v.model, v.plate_number,
                m.name AS mechanic,
                i.id AS invoice_id, i.invoice_number, i.status::text AS invoice_status,
                i.subtotal, i.discount, i.total,
                COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id = i.id), 0) AS paid
             FROM job_cards j
             JOIN users c ON c.id = j.customer_id
             JOIN vehicles v ON v.id = j.vehicle_id
             LEFT JOIN users m ON m.id = j.assigned_mechanic_id
             LEFT JOIN invoices i ON i.job_id = j.id
             WHERE j.status::text IN ('Completed', 'Ready for Collection', 'Collected')
               AND $w
             ORDER BY j.closed_at DESC NULLS LAST, j.id DESC", $p);

        $jobIds = array_map(fn($j) => (int) $j['id'], $jobs);

        $servicesByJob = [];
        $partsByJob = [];
        $approvalsByJob = [];
        $paymentsByInvoice = [];

        if ($jobIds) {
            $in = implode(',', $jobIds); // ints only, safe to inline

            $servicesByJob = self::groupBy(self::rows($db, "SELECT js.job_id, js.description, js.quantity, js.unit_price,
                    s.name AS service_name, u.name AS recorded_by
                 FROM job_services js
                 JOIN services s ON s.id = js.service_id
                 LEFT JOIN users u ON u.id = js.recorded_by
                 WHERE js.job_id IN ($in)
                 ORDER BY js.id"), 'job_id');

            $partsByJob = self::groupBy(self::rows($db, "SELECT jp.job_id, jp.quantity, jp.unit_price,
                    p.name AS part_name, p.sku
                 FROM job_parts jp
                 JOIN parts p ON p.id = jp.part_id
                 WHERE jp.job_id IN ($in)
                 ORDER BY jp.id"), 'job_id');

            $approvalsByJob = self::groupBy(self::rows($db, "SELECT ja.job_id, ja.description, ja.estimated_cost,
                    ja.status::text AS status, ja.requested_at, ja.decided_at
                 FROM job_approvals ja
                 WHERE ja.job_id IN ($in)
                 ORDER BY ja.requested_at"), 'job_id');

            $invoiceIds = array_values(array_filter(array_map(fn($j) => $j['invoice_id'], $jobs)));
            if ($invoiceIds) {
                $invIn = implode(',', array_map('intval', $invoiceIds));
                $paymentsByInvoice = self::groupBy(self::rows($db, "SELECT invoice_id, amount, method, paid_at
                     FROM payments WHERE invoice_id IN ($invIn) ORDER BY paid_at"), 'invoice_id');
            }
        }

        $completed = [];
        $labourTotal = 0.0;
        $partsTotal = 0.0;
        $extraLabourTotal = 0.0;
        $completedValue = 0.0;
        $completedPaid = 0.0;
        $mechanicStats = [];
        $serviceStats = [];
        $customerJobs = [];

        foreach ($jobs as $job) {
            $jid = (int) $job['id'];

            $services = array_map(fn($s) => [
                'service' => $s['service_name'],
                'description' => $s['description'],
                'quantity' => (int) $s['quantity'],
                'unit_price' => (float) $s['unit_price'],
                'amount' => round((float) $s['quantity'] * (float) $s['unit_price'], 2),
                'recorded_by' => $s['recorded_by'],
            ], $servicesByJob[$jid] ?? []);

            $parts = array_map(fn($x) => [
                'part' => $x['part_name'],
                'sku' => $x['sku'],
                'quantity' => (int) $x['quantity'],
                'unit_price' => (float) $x['unit_price'],
                'amount' => round((float) $x['quantity'] * (float) $x['unit_price'], 2),
            ], $partsByJob[$jid] ?? []);

            $approvals = array_map(fn($a) => [
                'description' => $a['description'],
                'estimated_cost' => (float) $a['estimated_cost'],
                'status' => $a['status'],
                'requested_at' => $a['requested_at'],
                'decided_at' => $a['decided_at'],
            ], $approvalsByJob[$jid] ?? []);

            $payments = array_map(fn($pay) => [
                'amount' => (float) $pay['amount'],
                'method' => $pay['method'],
                'paid_at' => $pay['paid_at'],
            ], $paymentsByInvoice[(int) $job['invoice_id']] ?? []);

            $servicesAmount = array_sum(array_column($services, 'amount'));
            $partsAmount = array_sum(array_column($parts, 'amount'));
            $subtotal = (float) ($job['subtotal'] ?? 0);
            $extraLabour = $job['invoice_id'] ? round($subtotal - $servicesAmount - $partsAmount, 2) : 0.0;
            $total = (float) ($job['total'] ?? 0);
            $paid = (float) $job['paid'];

            $labourTotal += $servicesAmount + $extraLabour;
            $partsTotal += $partsAmount;
            $extraLabourTotal += $extraLabour;
            $completedValue += $total;
            $completedPaid += $paid;

            $mechanic = $job['mechanic'] ?: 'Unassigned';
            if (!isset($mechanicStats[$mechanic])) {
                $mechanicStats[$mechanic] = ['mechanic' => $mechanic, 'jobs' => 0, 'value' => 0.0, 'paid' => 0.0];
            }
            $mechanicStats[$mechanic]['jobs']++;
            $mechanicStats[$mechanic]['value'] += $total;
            $mechanicStats[$mechanic]['paid'] += $paid;

            foreach ($services as $s) {
                $name = $s['service'];
                if (!isset($serviceStats[$name])) {
                    $serviceStats[$name] = ['service' => $name, 'times' => 0, 'revenue' => 0.0];
                }
                $serviceStats[$name]['times']++;
                $serviceStats[$name]['revenue'] += $s['amount'];
            }

            $customerJobs[$job['customer']] = ($customerJobs[$job['customer']] ?? 0) + 1;

            $completed[] = [
                'id' => $jid,
                'job_number' => $job['job_number'],
                'status' => $job['status'],
                'customer' => $job['customer'],
                'customer_phone' => $job['customer_phone'],
                'vehicle' => trim(($job['make'] ?? '') . ' ' . ($job['model'] ?? '')),
                'plate_number' => $job['plate_number'],
                'mechanic' => $job['mechanic'],
                'reported_problem' => $job['reported_problem'],
                'diagnosis' => $job['diagnosis'],
                'work_performed' => $job['work_performed'],
                'completion_notes' => $job['completion_notes'],
                'opened_at' => $job['opened_at'],
                'closed_at' => $job['closed_at'],
                'services' => $services,
                'parts' => $parts,
                'approvals' => $approvals,
                'invoice' => $job['invoice_id'] ? [
                    'invoice_number' => $job['invoice_number'],
                    'status' => $job['invoice_status'],
                    'services_total' => round($servicesAmount, 2),
                    'parts_total' => round($partsAmount, 2),
                    'additional_labour' => $extraLabour,
                    'subtotal' => $subtotal,
                    'discount' => (float) ($job['discount'] ?? 0),
                    'total' => $total,
                    'paid' => $paid,
                    'balance' => round($total - $paid, 2),
                    'payments' => $payments,
                ] : null,
                'totals' => [
                    'services' => round($servicesAmount, 2),
                    'parts' => round($partsAmount, 2),
                    'additional_labour' => $extraLabour,
                    'total' => $total,
                    'paid' => $paid,
                ],
            ];
        }

        // =========================================================
        // 2. CASH
        // =========================================================
        $p = [];
        $w = self::between('pay.paid_at', 'p1', $from, $to, $p);
        $cash = self::one($db, "SELECT COALESCE(SUM(pay.amount), 0) AS total, COUNT(*) AS count
             FROM payments pay WHERE $w", $p);

        $p = [];
        $w = self::between('pay.paid_at', 'p2', $from, $to, $p);
        $byMethod = self::rows($db, "SELECT COALESCE(pay.method, 'Unknown') AS method, COUNT(*) AS count,
                COALESCE(SUM(pay.amount), 0) AS total
             FROM payments pay WHERE $w
             GROUP BY pay.method ORDER BY total DESC", $p);

        $p = [];
        $w = self::between('pay.paid_at', 'p3', $from, $to, $p);
        $bySource = self::rows($db, "SELECT CASE
                    WHEN i.job_id IS NOT NULL THEN 'Workshop job'
                    WHEN i.order_id IS NOT NULL THEN 'Parts order'
                    ELSE 'Other'
                END AS source,
                COUNT(*) AS count, COALESCE(SUM(pay.amount), 0) AS total
             FROM payments pay
             JOIN invoices i ON i.id = pay.invoice_id
             WHERE $w
             GROUP BY 1 ORDER BY total DESC", $p);

        $p = [];
        $w = self::between('i.created_at', 'i1', $from, $to, $p);
        $raised = self::one($db, "SELECT COALESCE(SUM(i.total), 0) AS total, COUNT(*) AS count
             FROM invoices i
             WHERE i.status::text NOT IN ('Cancelled', 'Refunded') AND $w", $p);

        $outstandingRow = self::one($db, "SELECT COALESCE(SUM(i.total - COALESCE(pay.paid, 0)), 0) AS total, COUNT(*) AS count
             FROM invoices i
             LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) pay
                    ON pay.invoice_id = i.id
             WHERE i.status::text IN ('Unpaid', 'Partially Paid')");

        // =========================================================
        // 3. MOST SOLD PRODUCTS (descending by units)
        // =========================================================
        $p = [];
        $w1 = self::between('i.created_at', 'a', $from, $to, $p);
        $w2 = self::between('i.created_at', 'b', $from, $to, $p);
        $topSold = self::rows($db, "SELECT p.id, p.name, p.sku, p.category,
                SUM(s.qty) AS units,
                SUM(s.qty * s.price) AS revenue,
                SUM(s.qty * (s.price - COALESCE(p.unit_price, 0))) AS margin
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
             GROUP BY p.id, p.name, p.sku, p.category
             ORDER BY units DESC, revenue DESC
             LIMIT 20", $p);

        $salesUnits = 0;
        $salesRevenue = 0.0;
        foreach ($topSold as &$row) {
            $row['units'] = (int) $row['units'];
            $row['revenue'] = round((float) $row['revenue'], 2);
            $row['margin'] = round((float) $row['margin'], 2);
            $salesUnits += $row['units'];
            $salesRevenue += $row['revenue'];
        }
        unset($row);

        foreach ($topSold as &$row) {
            $row['share'] = $salesRevenue > 0 ? round(($row['revenue'] / $salesRevenue) * 100, 1) : 0.0;
        }
        unset($row);

        // =========================================================
        // 4. BUSINESS ANALYSIS
        // =========================================================
        $completedCount = count($completed);
        $repeatCustomers = 0;
        foreach ($customerJobs as $count) {
            if ($count > 1) {
                $repeatCustomers++;
            }
        }

        $mechanicRows = array_values($mechanicStats);
        usort($mechanicRows, fn($a, $b) => $b['jobs'] <=> $a['jobs']);

        $serviceRows = array_values($serviceStats);
        usort($serviceRows, fn($a, $b) => $b['times'] <=> $a['times']);

        $received = (float) $cash['total'];
        $raisedTotal = (float) $raised['total'];

        $analysis = [
            'completed_jobs' => $completedCount,
            'completed_value' => round($completedValue, 2),
            'completed_paid' => round($completedPaid, 2),
            'average_job_value' => $completedCount > 0 ? round($completedValue / $completedCount, 2) : 0.0,
            'labour_revenue' => round($labourTotal, 2),
            'parts_revenue' => round($partsTotal, 2),
            'additional_labour' => round($extraLabourTotal, 2),
            'labour_share' => $completedValue > 0 ? round(($labourTotal / $completedValue) * 100, 1) : 0.0,
            'parts_share' => $completedValue > 0 ? round(($partsTotal / $completedValue) * 100, 1) : 0.0,
            'unique_customers' => count($customerJobs),
            'repeat_customers' => $repeatCustomers,
            'collection_rate' => $raisedTotal > 0 ? round(($received / $raisedTotal) * 100, 1) : 0.0,
            'mechanics' => array_map(fn($m) => [
                'mechanic' => $m['mechanic'],
                'jobs' => $m['jobs'],
                'value' => round($m['value'], 2),
                'paid' => round($m['paid'], 2),
            ], $mechanicRows),
            'services' => array_map(fn($s) => [
                'service' => $s['service'],
                'times' => $s['times'],
                'revenue' => round($s['revenue'], 2),
            ], array_slice($serviceRows, 0, 10)),
        ];

        Response::success([
            'range' => ['from' => $rawFrom ?: null, 'to' => $rawTo ?: null],
            'generated_at' => date('c'),
            'completed_services' => $completed,
            'cash' => [
                'received' => round($received, 2),
                'payments' => (int) $cash['count'],
                'raised' => round($raisedTotal, 2),
                'invoices_raised' => (int) $raised['count'],
                'outstanding' => round((float) $outstandingRow['total'], 2),
                'outstanding_count' => (int) $outstandingRow['count'],
                'by_method' => array_map(fn($m) => [
                    'method' => $m['method'],
                    'count' => (int) $m['count'],
                    'total' => round((float) $m['total'], 2),
                ], $byMethod),
                'by_source' => array_map(fn($s) => [
                    'source' => $s['source'],
                    'count' => (int) $s['count'],
                    'total' => round((float) $s['total'], 2),
                ], $bySource),
            ],
            'top_sold' => $topSold,
            'sales_totals' => [
                'units' => $salesUnits,
                'revenue' => round($salesRevenue, 2),
            ],
            'analysis' => $analysis,
        ]);
    }
}
