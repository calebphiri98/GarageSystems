<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Jwt.php';
require_once __DIR__ . '/../helpers/Response.php';

function require_auth(): array
{
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        Response::error('Not authenticated. Missing token.', 401);
    }
    $payload = Jwt::decode($matches[1]);
    if (!$payload || !isset($payload['id'])) {
        Response::error('Invalid or expired session. Please log in again.', 401);
    }

    $db = Database::connect();
    $stmt = $db->prepare('SELECT id, name, email, role, is_active FROM users WHERE id = :id');
    $stmt->execute([':id' => $payload['id']]);
    $row = $stmt->fetch();

    if (!$row) {
        Response::error('This account no longer exists. Please log in again.', 401);
    }
    if (!$row['is_active']) {
        Response::error('This account has been deactivated. Contact the garage administrator.', 401);
    }

    $payload['id'] = $row['id'];
    $payload['name'] = $row['name'];
    $payload['email'] = $row['email'];

    $payload['role'] = $row['role'];

    return $payload;
}

function require_role(array $payload, array $allowedRoles): void
{
    if (!in_array($payload['role'], $allowedRoles, true)) {
        Response::error('You do not have permission to perform this action.', 403);
    }
}