<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class UserController
{
    public static function listStaff(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $search = trim($_GET['search'] ?? '');
        $db = Database::connect();
        $sql = "SELECT id, name, email, phone, role, specialty, is_active, created_at
                FROM users WHERE role IN ('admin','manager','mechanic')";
        $params = [];
        if ($search !== '') {
            $sql .= " AND (LOWER(name) LIKE :search OR LOWER(email) LIKE :search OR LOWER(role::text) LIKE :search)";
            $params[':search'] = '%' . strtolower($search) . '%';
        }
        $sql .= ' ORDER BY role, name';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public static function listMechanics(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);


        $db = Database::connect();
        $stmt = $db->query(
            "SELECT id, name, specialty, is_active FROM users WHERE role = 'mechanic' AND is_active = TRUE ORDER BY name"
        );
        Response::success($stmt->fetchAll());
    }

    public static function listCustomers(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $search = trim($_GET['search'] ?? '');
        $db = Database::connect();
        $sql = "SELECT id, name, email, phone, is_active, created_at FROM users WHERE role = 'customer'";
        $params = [];
        if ($search !== '') {
            $sql .= ' AND (LOWER(name) LIKE :search OR LOWER(email) LIKE :search)';
            $params[':search'] = '%' . strtolower($search) . '%';
        }
        $sql .= ' ORDER BY name';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public static function toggleActive(int $id): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);


        if ($id === $payload['id']) {
            Response::error('You cannot deactivate your own account.', 422);
        }

        $db = Database::connect();
        $stmt = $db->prepare('SELECT id, name, is_active, role FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('User not found.', 404);
        }

        if (in_array($user['role'], ['admin', 'manager'], true) && $payload['role'] !== 'manager') {
            Response::error('Only a manager can deactivate or reactivate an admin or manager account.', 403);
        }

        $newStatus = !$user['is_active'];
        $upd = $db->prepare('UPDATE users SET is_active = :status WHERE id = :id');
        $upd->execute([':status' => $newStatus ? 'true' : 'false', ':id' => $id]);

        $verb = $newStatus ? 'Reactivated' : 'Deactivated';
        Audit::log(
            $payload['id'],
            $payload['role'],
            "$verb {$user['role']} account: {$user['name']}",
            'users',
            $id,
            ['is_active' => $user['is_active']],
            ['is_active' => $newStatus]
        );

        Response::success(['is_active' => $newStatus], "Account {$verb}.");

    }

    public static function delete(int $id): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        if ($id === $payload['id']) {
            Response::error('You cannot delete your own account.', 422);
        }

        $db = Database::connect();
        $stmt = $db->prepare('SELECT id, name, role FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('User not found.', 404);
        }

        if (in_array($user['role'], ['admin', 'manager'], true) && $payload['role'] !== 'manager') {
            Response::error('Only a manager can delete an admin or manager account.', 403);
        }

        $checks = [
            'vehicles' => 'SELECT COUNT(*) FROM vehicles WHERE customer_id = :id',
            'appointments' => 'SELECT COUNT(*) FROM appointments WHERE customer_id = :id',
            'job_cards (as customer)' => 'SELECT COUNT(*) FROM job_cards WHERE customer_id = :id',
            'job_cards (as mechanic)' => 'SELECT COUNT(*) FROM job_cards WHERE assigned_mechanic_id = :id',
            'orders' => 'SELECT COUNT(*) FROM orders WHERE customer_id = :id',
            'invoices' => 'SELECT COUNT(*) FROM invoices WHERE customer_id = :id',
        ];
        foreach ($checks as $label => $sql) {

            $c = $db->prepare($sql);
            $c->execute([':id' => $id]);
            if ((int) $c->fetchColumn() > 0) {
                Response::error(
                    "Cannot delete {$user['name']}: this account still has related $label. Deactivate the account instead to preserve history.",
                    422
                );
            }
        }

        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM notifications WHERE user_id = :id')->execute([':id' => $id]);
            $db->prepare('UPDATE audit_logs SET user_id = NULL WHERE user_id = :id')->execute([':id' => $id]);
            $db->prepare('UPDATE stock_movements SET created_by = NULL WHERE created_by = :id')->execute([':id' => $id]);

            $del = $db->prepare('DELETE FROM users WHERE id = :id');
            $del->execute([':id' => $id]);
            $db->commit();
        } catch (PDOException $e) {
            $db->rollBack();
            error_log('User delete failed for id ' . $id . ': ' . $e->getMessage());
            Response::error(
                "Cannot delete {$user['name']}: this account is still referenced elsewhere in the system's records. Deactivate the account instead to preserve history.",
                422
            );
        }

        Audit::log($payload['id'], $payload['role'], "Deleted {$user['role']} account: {$user['name']}", 'users', $id);
        Response::success([], 'User account deleted.');
    }
}