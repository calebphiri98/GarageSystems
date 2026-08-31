<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class UserController
{
    /** List staff (admin/manager/mechanic) - used to populate "assign mechanic" dropdowns etc. */
    public static function listStaff(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $stmt = $db->query(
            "SELECT id, name, email, phone, role, specialty, is_active, created_at
             FROM users WHERE role IN ('admin','manager','mechanic') ORDER BY role, name"
        );
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

        $db = Database::connect();
        $stmt = $db->query("SELECT id, name, email, phone, created_at FROM users WHERE role = 'customer' ORDER BY name");
        Response::success($stmt->fetchAll());
    }

    /** Activate / deactivate a staff account. */
    public static function toggleActive(int $id): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $stmt = $db->prepare('SELECT id, is_active, role FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('User not found.', 404);
        }

        $newStatus = !$user['is_active'];
        $upd = $db->prepare('UPDATE users SET is_active = :status WHERE id = :id');
        $upd->execute([':status' => $newStatus, ':id' => $id]);

        Audit::log($payload['id'], $payload['role'], 'Toggled user active status', 'users', $id, ['is_active' => $user['is_active']], ['is_active' => $newStatus]);

        Response::success(['is_active' => $newStatus], 'User status updated.');
    }
}
