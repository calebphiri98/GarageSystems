<?php
require_once __DIR__ . '/../config/database.php';

class Audit
{
    public static function log(
        ?int $userId,
        ?string $role,
        string $action,
        ?string $table = null,
        ?int $affectedId = null,
        $previous = null,
        $new = null,
        ?string $reason = null
    ): void {
        $db = Database::connect();
        $stmt = $db->prepare(
            'INSERT INTO audit_logs (user_id, role, action, affected_table, affected_id, previous_value, new_value, reason)
             VALUES (:user_id, :role, :action, :table, :affected_id, :previous, :new, :reason)'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':role' => $role,
            ':action' => $action,
            ':table' => $table,
            ':affected_id' => $affectedId,
            ':previous' => $previous !== null ? json_encode($previous) : null,
            ':new' => $new !== null ? json_encode($new) : null,
            ':reason' => $reason,
        ]);
    }
}
