<?php
/**
 * Smoke test for GET /reports/manager/activity against the local MySQL DB.
 * Run:  php backend-local/tools/test_manager_activity.php [from] [to]
 */
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';

// Stub auth so the controller can run from the CLI.
$stub = sys_get_temp_dir() . '/ug_auth_stub.php';
file_put_contents($stub, <<<'PHP'
<?php
function require_auth(): array
{
    return ['id' => 1, 'role' => 'manager'];
}
function require_role(array $payload, array $roles): void
{
}
PHP);
require_once $stub;

require_once __DIR__ . '/../controllers/ManagerActivityReportController.php';

$_GET = [];
if (isset($argv[1])) { $_GET['from'] = $argv[1]; }
if (isset($argv[2])) { $_GET['to'] = $argv[2]; }

ob_start();
try {
    ManagerActivityReportController::overview();
} catch (Throwable $e) {
    ob_end_clean();
    fwrite(STDERR, "FAILED: " . $e->getMessage() . "\n");
    exit(1);
}
$raw = ob_get_clean();
$json = json_decode($raw, true);

if (!is_array($json)) {
    fwrite(STDERR, "Non-JSON output:\n" . substr($raw, 0, 2000) . "\n");
    exit(1);
}
if (empty($json['success'])) {
    fwrite(STDERR, "API error: " . ($json['message'] ?? 'unknown') . "\n");
    exit(1);
}

$d = $json['data'];
echo "OK\n";
echo "  completed_services : " . count($d['completed_services']) . "\n";
echo "  cash received      : " . $d['cash']['received'] . "\n";
echo "  top_sold rows      : " . count($d['top_sold']) . "\n";
echo "  completed jobs     : " . $d['analysis']['completed_jobs'] . "\n";
echo "  mechanics          : " . count($d['analysis']['mechanics']) . "\n";
echo "  services           : " . count($d['analysis']['services']) . "\n";

foreach ($d['completed_services'] as $j) {
    echo "  - {$j['job_number']} | {$j['customer']} | {$j['status']} | closed {$j['closed_at']}"
        . " | services " . count($j['services']) . " | parts " . count($j['parts'])
        . " | total " . $j['totals']['total'] . "\n";
}
