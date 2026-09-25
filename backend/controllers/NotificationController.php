<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/auth.php';

class NotificationController
{
    public static function list(): void
    {
        $payload = require_auth();
        $db = Database::connect();
        $stmt = $db->prepare('SELECT * FROM notifications WHERE user_id = :id ORDER BY created_at DESC LIMIT 50');
        $stmt->execute([':id' => $payload['id']]);
        Response::success($stmt->fetchAll());
    }

    public static function markRead(int $id): void
    {
        $payload = require_auth();
        $db = Database::connect();
        $stmt = $db->prepare('UPDATE notifications SET is_read = TRUE WHERE id = :id AND user_id = :uid');
        $stmt->execute([':id' => $id, ':uid' => $payload['id']]);
        Response::success([], 'Marked as read.');
    }
}
