<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class ReportController
{
    public static function summary(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();

        $counts = [
            'pending_appointments' => $db->query("SELECT COUNT(*) c FROM appointments WHERE status = 'Pending'")->fetch()['c'],
            'active_jobs' => $db->query("SELECT COUNT(*) c FROM job_cards WHERE status NOT IN ('Collected')")->fetch()['c'],
            'jobs_awaiting_approval' => $db->query("SELECT COUNT(*) c FROM job_cards WHERE status = 'Awaiting Approval'")->fetch()['c'],
            'ready_for_collection' => $db->query("SELECT COUNT(*) c FROM job_cards WHERE status = 'Ready for Collection'")->fetch()['c'],
            'pending_orders' => $db->query("SELECT COUNT(*) c FROM orders WHERE status = 'Pending'")->fetch()['c'],
            'low_stock_parts' => $db->query('SELECT COUNT(*) c FROM parts WHERE quantity <= min_stock_level')->fetch()['c'],
            'unpaid_invoices' => $db->query("SELECT COUNT(*) c FROM invoices WHERE status IN ('Unpaid','Partially Paid')")->fetch()['c'],
            'total_revenue_paid' => $db->query("SELECT COALESCE(SUM(amount),0) c FROM payments")->fetch()['c'],
            'total_customers' => $db->query("SELECT COUNT(*) c FROM users WHERE role = 'customer'")->fetch()['c'],
            'total_mechanics' => $db->query("SELECT COUNT(*) c FROM users WHERE role = 'mechanic' AND is_active = TRUE")->fetch()['c'],
        ];

        Response::success($counts);
    }

    private static function validDate(string $d): bool

    {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) {
            return false;
        }
        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }

    private static function requiredRange(): array
    {
        $from = trim($_GET['from'] ?? '');
        $to = trim($_GET['to'] ?? '');

        if ($from === '' || $to === '') {
            Response::error('Both a from date and a to date are required.', 422);
        }
        if (!self::validDate($from) || !self::validDate($to)) {
            Response::error('Dates must be in YYYY-MM-DD format.', 422);
        }
        if ($from > $to) {
            Response::error('The from date cannot be after the to date.', 422);
        }
        return [$from, $to];
    }

    public static function auditLog(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $from = trim($_GET['from'] ?? '');
        $to = trim($_GET['to'] ?? '');


        $db = Database::connect();
        $sql = 'SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id';
        $params = [];

        if ($from !== '' || $to !== '') {
            [$from, $to] = self::requiredRange();
            $sql .= " WHERE a.created_at >= CAST(:from AS date) AND a.created_at < (CAST(:to AS date) + INTERVAL '1 day')";
            $params[':from'] = $from;
            $params[':to'] = $to;
        }

        $sql .= ' ORDER BY a.created_at DESC LIMIT 200';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public static function countAuditLog(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin']);

        [$from, $to] = self::requiredRange();

        $db = Database::connect();
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM audit_logs
             WHERE created_at >= CAST(:from AS date) AND created_at < (CAST(:to AS date) + INTERVAL '1 day')"
        );
        $stmt->execute([':from' => $from, ':to' => $to]);

        Response::success(['count' => (int) $stmt->fetchColumn()]);

    }

    public static function clearAuditLog(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin']);

        [$from, $to] = self::requiredRange();

        $db = Database::connect();
        $stmt = $db->prepare(
            "DELETE FROM audit_logs
             WHERE created_at >= CAST(:from AS date) AND created_at < (CAST(:to AS date) + INTERVAL '1 day')"
        );
        $stmt->execute([':from' => $from, ':to' => $to]);
        $deleted = $stmt->rowCount();

        Audit::log(
            $payload['id'],
            $payload['role'],
            "Cleared $deleted audit log entries from $from to $to",
            'audit_logs'
        );

        Response::success(['deleted' => $deleted], "$deleted audit log entries cleared.");
    }
}