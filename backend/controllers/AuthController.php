<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Jwt.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class AuthController
{
    /** Public: customer self-registration. Role is always forced to 'customer' here. */
    public static function register(array $body): void
    {
        $name = trim($body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $phone = trim($body['phone'] ?? '');
        $password = $body['password'] ?? '';

        if (!$name || !$email || strlen($password) < 6) {
            Response::error('Name, a valid email and a password of at least 6 characters are required.');
        }

        $db = Database::connect();
        $check = $db->prepare('SELECT id FROM users WHERE email = :email');
        $check->execute([':email' => $email]);
        if ($check->fetch()) {
            Response::error('An account with this email already exists.', 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $db->prepare(
            'INSERT INTO users (name, email, phone, password_hash, role) VALUES (:name, :email, :phone, :hash, :role) RETURNING id'
        );
        $stmt->execute([':name' => $name, ':email' => $email, ':phone' => $phone, ':hash' => $hash, ':role' => 'customer']);
        $id = $stmt->fetch()['id'];

        Audit::log($id, 'customer', 'Customer self-registered', 'users', $id);

        Response::success(['id' => $id], 'Account created. You can now log in.', 201);
    }

    /**
     * Admin-only: create staff accounts (admin, manager, mechanic).
     * This is the "add new users of the same company, like engineers" requirement.
     */
    public static function addStaff(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $name = trim($body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $phone = trim($body['phone'] ?? '');
        $password = $body['password'] ?? '';
        $role = $body['role'] ?? '';
        $specialty = trim($body['specialty'] ?? '');

        $allowedRoles = ['admin', 'mechanic', 'manager'];
        if (!$name || !$email || strlen($password) < 6 || !in_array($role, $allowedRoles, true)) {
            Response::error('Name, valid email, password (6+ chars) and a valid role (admin, mechanic, manager) are required.');
        }

        // Only a manager may create another admin or manager account.
        if (in_array($role, ['admin', 'manager'], true) && $payload['role'] !== 'manager') {
            Response::error('Only a manager can create admin or manager accounts.', 403);
        }

        $db = Database::connect();
        $check = $db->prepare('SELECT id FROM users WHERE email = :email');
        $check->execute([':email' => $email]);
        if ($check->fetch()) {
            Response::error('An account with this email already exists.', 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $db->prepare(
            'INSERT INTO users (name, email, phone, password_hash, role, specialty, created_by)
             VALUES (:name, :email, :phone, :hash, :role, :specialty, :created_by) RETURNING id'
        );
        $stmt->execute([
            ':name' => $name, ':email' => $email, ':phone' => $phone, ':hash' => $hash,
            ':role' => $role, ':specialty' => $specialty ?: null, ':created_by' => $payload['id'],
        ]);
        $id = $stmt->fetch()['id'];

        Audit::log($payload['id'], $payload['role'], "Created new $role account", 'users', $id, null, ['name' => $name, 'email' => $email]);

        Response::success(['id' => $id], ucfirst($role) . ' account created.', 201);
    }

    public static function login(array $body): void
    {
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';

        if (!$email || !$password) {
            Response::error('Email and password are required.');
        }

        $db = Database::connect();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::error('Invalid email or password.', 401);
        }
        if (!$user['is_active']) {
            Response::error('This account has been deactivated. Contact the garage administrator.', 403);
        }

        $token = Jwt::encode([
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ]);

        Audit::log($user['id'], $user['role'], 'Logged in');

        Response::success([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'specialty' => $user['specialty'],
            ],
        ], 'Login successful. Redirecting to your dashboard.');
    }

    public static function me(): void
    {
        $payload = require_auth();
        Response::success(['user' => $payload]);
    }
}
