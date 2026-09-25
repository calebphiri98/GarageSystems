<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
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

    public static function auditLog(): void
    {
        $payload = require_auth();
        require_role($payload, ['manager']);

        $db = Database::connect();
        $stmt = $db->query(
            'SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 200'
        );
        Response::success($stmt->fetchAll());
    }
}
