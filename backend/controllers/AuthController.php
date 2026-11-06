<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Jwt.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../helpers/Mailer.php';
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

    /**
     * Public: request a password reset link. Always returns a generic message
     * so callers cannot discover whether an email is registered.
     */
    public static function forgotPassword(array $body): void
    {
        $rawEmail = $body['email'] ?? '';
        $email = is_string($rawEmail) ? strtolower(trim($rawEmail)) : '';
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Please enter a valid email address.');
        }

        $generic = 'If an account exists with that email address, password reset instructions have been sent. Please check your inbox.';
        $db = Database::connect();

        $stmt = $db->prepare('SELECT id, name, email, is_active FROM users WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !self::isActive($user['is_active'])) {
            Response::success([], $generic);
        }

        // Rate limit: at most 3 reset requests per account every 10 minutes.
        $since = gmdate('Y-m-d H:i:s', time() - 600);
        $count = $db->prepare('SELECT COUNT(*) AS c FROM password_reset_tokens WHERE user_id = :id AND created_at > :since');
        $count->execute([':id' => $user['id'], ':since' => $since]);
        if ((int) $count->fetch()['c'] >= 3) {
            Response::success([], $generic);
        }

        $ttl = (int) env('PASSWORD_RESET_TTL_MINUTES', 30);
        if ($ttl < 5 || $ttl > 1440) {
            $ttl = 30;
        }

        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $now = gmdate('Y-m-d H:i:s');
        $expires = gmdate('Y-m-d H:i:s', time() + ($ttl * 60));

        // Any earlier unused tokens for this account stop working.
        $invalidate = $db->prepare('UPDATE password_reset_tokens SET used_at = :now WHERE user_id = :id AND used_at IS NULL');
        $invalidate->execute([':now' => $now, ':id' => $user['id']]);

        $insert = $db->prepare(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
             VALUES (:user_id, :token_hash, :expires_at, :created_at)'
        );
        $insert->execute([
            ':user_id' => $user['id'],
            ':token_hash' => $tokenHash,
            ':expires_at' => $expires,
            ':created_at' => $now,
        ]);

        Mailer::sendPasswordReset(
            $user['email'],
            $user['name'],
            'reset-password?token=' . urlencode($token),
            $ttl
        );

        Response::success([], $generic);
    }

    /**
     * Public: complete a password reset using a single-use, time-limited token.
     */
    public static function resetPassword(array $body): void
    {
        $token = $body['token'] ?? '';
        $password = $body['password'] ?? '';
        $confirmation = $body['password_confirmation'] ?? $body['confirm_password'] ?? null;

        if (!is_string($token) || strlen($token) < 32) {
            Response::error('This password reset link is invalid or has expired.', 400);
        }
        if (!is_string($password) || ($confirmation !== null && !is_string($confirmation))) {
            Response::error('Please provide a valid password.');
        }
        if ($confirmation !== null && $password !== $confirmation) {
            Response::error('The two passwords do not match.');
        }
        $passwordError = self::passwordError($password);
        if ($passwordError !== null) {
            Response::error($passwordError);
        }

        $db = Database::connect();
        $lookup = $db->prepare(
            'SELECT t.id, t.user_id, t.expires_at, t.used_at, u.role
             FROM password_reset_tokens t
             JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = :token_hash'
        );
        $lookup->execute([':token_hash' => hash('sha256', $token)]);
        $row = $lookup->fetch();

        if (!$row || $row['used_at'] !== null || strtotime($row['expires_at'] . ' UTC') < time()) {
            Response::error('This password reset link is invalid or has expired.', 400);
        }

        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $now = gmdate('Y-m-d H:i:s');

        try {
            $db->beginTransaction();

            $useToken = $db->prepare('UPDATE password_reset_tokens SET used_at = :now WHERE id = :id AND used_at IS NULL');
            $useToken->execute([':now' => $now, ':id' => $row['id']]);
            if ($useToken->rowCount() < 1) {
                $db->rollBack();
                Response::error('This password reset link is invalid or has expired.', 400);
            }

            $update = $db->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
            $update->execute([':hash' => $newHash, ':id' => $row['user_id']]);

            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::error('Could not reset the password. Please try again.', 500);
        }

        Audit::log($row['user_id'], $row['role'], 'Password reset via email link', 'users', $row['user_id']);

        Response::success([], 'Your password has been reset successfully. You can now sign in using your new password.');
    }

    private static function passwordError(string $password): ?string
    {
        if (strlen($password) < 8) {
            return 'Password must be at least 8 characters long.';
        }
        if (!preg_match('/[A-Z]/', $password)) {
            return 'Password must include at least one uppercase letter.';
        }
        if (!preg_match('/[a-z]/', $password)) {
            return 'Password must include at least one lowercase letter.';
        }
        if (!preg_match('/[0-9]/', $password)) {
            return 'Password must include at least one number.';
        }
        if (!preg_match('/[^A-Za-z0-9]/', $password)) {
            return 'Password must include at least one special character.';
        }
        return null;
    }

    private static function isActive($value): bool
    {
        return $value === true || $value === 1 || $value === '1' || $value === 't' || $value === 'true';
    }
}
