<?php
require_once __DIR__ . '/backend/config/env.php';
require_once __DIR__ . '/backend/config/database.php';
if (PHP_SAPI !== 'cli') {
    exit(1);
}
$database = Database::connect();
$database->beginTransaction();
try {
    $database->exec(file_get_contents(__DIR__ . '/database/migrations/20261101_job_services.sql'));
    $database->commit();
    echo "Migration applied successfully.\n";
} catch (Throwable $e) {
    if ($database->inTransaction()) $database->rollBack();
    fwrite(STDERR, "Migration failed. Check database schema and permissions.\n");
    exit(1);
}
