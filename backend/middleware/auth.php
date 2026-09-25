<?php
require_once __DIR__ . '/../helpers/Jwt.php';
require_once __DIR__ . '/../helpers/Response.php';

/**
 * Reads the Authorization: Bearer <token> header, validates it,
 * and returns the decoded payload (id, name, email, role).
 * Ends the request with 401 if missing/invalid.
 */
function require_auth(): array
{
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        Response::error('Not authenticated. Missing token.', 401);
    }
    $payload = Jwt::decode($matches[1]);
    if (!$payload) {
        Response::error('Invalid or expired session. Please log in again.', 401);
    }
    return $payload;
}

/**
 * Ensures the authenticated user has one of the allowed roles.
 */
function require_role(array $payload, array $allowedRoles): void
{
    if (!in_array($payload['role'], $allowedRoles, true)) {
        Response::error('You do not have permission to perform this action.', 403);
    }
}
