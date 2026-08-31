<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class VehicleController
{
    public static function create(array $body): void
    {
        $payload = require_auth();

        $customerId = $payload['role'] === 'customer' ? $payload['id'] : ($body['customer_id'] ?? null);
        if (!$customerId) {
            Response::error('customer_id is required.');
        }
        $make = trim($body['make'] ?? '');
        $model = trim($body['model'] ?? '');
        $plate = strtoupper(trim($body['plate_number'] ?? ''));
        $year = $body['year'] ?? null;
        $vin = trim($body['vin'] ?? '');

        if (!$make || !$model || !$plate) {
            Response::error('Make, model and plate number are required.');
        }

        $db = Database::connect();
        try {
            $stmt = $db->prepare(
                'INSERT INTO vehicles (customer_id, make, model, year, plate_number, vin)
                 VALUES (:customer_id, :make, :model, :year, :plate, :vin) RETURNING id'
            );
            $stmt->execute([
                ':customer_id' => $customerId, ':make' => $make, ':model' => $model,
                ':year' => $year ?: null, ':plate' => $plate, ':vin' => $vin ?: null,
            ]);
            $id = $stmt->fetch()['id'];
        } catch (PDOException $e) {
            Response::error('A vehicle with that plate number already exists.', 409);
        }

        Audit::log($payload['id'], $payload['role'], 'Registered vehicle', 'vehicles', $id);
        Response::success(['id' => $id], 'Vehicle registered.', 201);
    }

    /** Customer sees their own vehicles; staff can pass ?customer_id= to filter, or see all. */
    public static function list(): void
    {
        $payload = require_auth();
        $db = Database::connect();

        if ($payload['role'] === 'customer') {
            $stmt = $db->prepare('SELECT * FROM vehicles WHERE customer_id = :cid ORDER BY created_at DESC');
            $stmt->execute([':cid' => $payload['id']]);
        } else {
            $customerId = $_GET['customer_id'] ?? null;
            if ($customerId) {
                $stmt = $db->prepare(
                    'SELECT v.*, u.name AS customer_name FROM vehicles v JOIN users u ON u.id = v.customer_id
                     WHERE v.customer_id = :cid ORDER BY v.created_at DESC'
                );
                $stmt->execute([':cid' => $customerId]);
            } else {
                $stmt = $db->query(
                    'SELECT v.*, u.name AS customer_name FROM vehicles v JOIN users u ON u.id = v.customer_id ORDER BY v.created_at DESC'
                );
            }
        }
        Response::success($stmt->fetchAll());
    }
}
