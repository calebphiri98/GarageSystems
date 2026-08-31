<?php
require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/env.php';

// Load all controllers
foreach (glob(__DIR__ . '/controllers/*.php') as $file) {
    require_once $file;
}

header('Content-Type: application/json');
require_once __DIR__ . '/helpers/Response.php';

// Parse the path after index.php, e.g. /api/jobs/12/assign -> ['jobs','12','assign']
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = trim(substr($uri, strlen($scriptDir)), '/');
$segments = $path === '' ? [] : explode('/', $path);
$method = $_SERVER['REQUEST_METHOD'];

$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true) ?: [];

// route: [segment0] [segment1(id?)] [segment2(action?)]
$resource = $segments[0] ?? '';
$id = isset($segments[1]) && is_numeric($segments[1]) ? (int) $segments[1] : null;
$action = $id !== null ? ($segments[2] ?? null) : ($segments[1] ?? null);

try {
    switch ($resource) {
        case 'auth':
            match (true) {
                $action === 'register' && $method === 'POST' => AuthController::register($body),
                $action === 'login' && $method === 'POST' => AuthController::login($body),
                $action === 'add-staff' && $method === 'POST' => AuthController::addStaff($body),
                $action === 'me' && $method === 'GET' => AuthController::me(),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'users':
            match (true) {
                $action === 'staff' && $method === 'GET' => UserController::listStaff(),
                $action === 'mechanics' && $method === 'GET' => UserController::listMechanics(),
                $action === 'customers' && $method === 'GET' => UserController::listCustomers(),
                $action === 'toggle-active' && $method === 'POST' && $id => UserController::toggleActive($id),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'vehicles':
            match (true) {
                $method === 'POST' && $id === null => VehicleController::create($body),
                $method === 'GET' && $id === null => VehicleController::list(),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'appointments':
            match (true) {
                $method === 'POST' && $id === null => AppointmentController::create($body),
                $method === 'GET' && $id === null => AppointmentController::list(),
                $method === 'PUT' && $action === 'status' && $id => AppointmentController::updateStatus($id, $body),
                $method === 'POST' && $action === 'convert' && $id => AppointmentController::convertToJob($id),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'jobs':
            match (true) {
                $method === 'POST' && $id === null => JobController::create($body),
                $method === 'GET' && $id === null => JobController::list(),
                $method === 'GET' && $id !== null && $action === null => JobController::get($id),
                $method === 'POST' && $action === 'assign' && $id => JobController::assignMechanic($id, $body),
                $method === 'PUT' && $action === 'mechanic-update' && $id => JobController::updateByMechanic($id, $body),
                $method === 'POST' && $action === 'request-approval' && $id => JobController::requestApproval($id, $body),
                $method === 'POST' && $action === 'use-part' && $id => JobController::usePart($id, $body),
                $method === 'POST' && $action === 'verify' && $id => JobController::verify($id),
                $method === 'POST' && $action === 'close' && $id => JobController::closeJob($id),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'approvals':
            match (true) {
                $method === 'PUT' && $action === 'decide' && $id => JobController::decideApproval($id, $body),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'inventory':
            match (true) {
                $method === 'GET' && $id === null && $action === null => InventoryController::list(),
                $method === 'GET' && $action === 'low-stock' => InventoryController::lowStock(),
                $method === 'POST' && $id === null => InventoryController::create($body),
                $method === 'POST' && $action === 'stock-in' && $id => InventoryController::stockIn($id, $body),
                $method === 'POST' && $action === 'adjust' && $id => InventoryController::adjust($id, $body),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'orders':
            match (true) {
                $method === 'POST' && $id === null => OrderController::create($body),
                $method === 'GET' && $id === null => OrderController::list(),
                $method === 'PUT' && $action === 'review' && $id => OrderController::review($id, $body),
                $method === 'PUT' && $action === 'status' && $id => OrderController::markStatus($id, $body),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'invoices':
            match (true) {
                $method === 'GET' && $id === null => InvoiceController::list(),
                $method === 'POST' && $action === 'from-job' && $id => InvoiceController::createFromJob($id, $body),
                $method === 'POST' && $action === 'from-order' && $id => InvoiceController::createFromOrder($id),
                $method === 'POST' && $action === 'pay' && $id => InvoiceController::recordPayment($id, $body),
                $method === 'PUT' && $action === 'cancel' && $id => InvoiceController::cancel($id, $body),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'notifications':
            match (true) {
                $method === 'GET' && $id === null => NotificationController::list(),
                $method === 'PUT' && $action === 'read' && $id => NotificationController::markRead($id),
                default => Response::error('Route not found.', 404),
            };
            break;

        case 'reports':
            match (true) {
                $action === 'summary' && $method === 'GET' => ReportController::summary(),
                $action === 'audit-log' && $method === 'GET' => ReportController::auditLog(),
                default => Response::error('Route not found.', 404),
            };
            break;

        case '':
            Response::success(['status' => 'Uptown Garage API is running']);
            break;

        default:
            Response::error('Route not found.', 404);
    }
} catch (Throwable $e) {
    Response::error('Server error: ' . $e->getMessage(), 500);
}
