<?php
require_once __DIR__ . '/env.php';

class Database
{
    private static ?PDO $instance = null;

    public static function connect(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $host = env('DB_HOST');
        $port = env('DB_PORT', '5432');
        $dbname = env('DB_NAME');
        $user = env('DB_USER');
        $pass = env('DB_PASS');
        $sslmode = env('DB_SSLMODE', 'require');

        // Older libpq builds (e.g. the one bundled with XAMPP on Windows) do not
        // send SNI, so Neon cannot identify the endpoint. Passing the endpoint id
        // explicitly keeps local PHP able to connect without a newer libpq.
        $endpoint = trim((string) env('DB_ENDPOINT', ''));
        $options = $endpoint !== '' ? ';options=endpoint=' . $endpoint : '';

        $dsn = "pgsql:host={$host};port={$port};dbname={$dbname};sslmode={$sslmode}{$options}";

        try {
            self::$instance = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => true,
            ]);
        } catch (PDOException $e) {
            error_log('Database connection failed: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database connection failed. Check your .env Neon credentials.'
            ]);
            exit;
        }

        return self::$instance;
    }
}