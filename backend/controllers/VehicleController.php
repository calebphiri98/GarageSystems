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
    public static function update(int $id, array $body): void
    {
        $payload = require_auth();

        require_role($payload, ['customer', 'admin', 'manager']);

        $db = Database::connect();

        $stmt = $db->prepare('SELECT * FROM vehicles WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $vehicle = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$vehicle) {
            Response::error('Vehicle not found.', 404);
        }

        if ($payload['role'] === 'customer' &&
            (int) $vehicle['customer_id'] !== (int) $payload['id']) {
            Response::error('You cannot edit this vehicle.', 403);
        }

        $make = trim((string) ($body['make'] ?? $vehicle['make']));
        $model = trim((string) ($body['model'] ?? $vehicle['model']));
        $plate = strtoupper(trim((string) ($body['plate_number'] ?? $vehicle['plate_number'])));
        $vin = trim((string) ($body['vin'] ?? $vehicle['vin'] ?? ''));

        $yearInput = $body['year'] ?? $vehicle['year'];
        $year = ($yearInput === '' || $yearInput === null)
            ? null
            : filter_var($yearInput, FILTER_VALIDATE_INT);

        if ($make === '' || $model === '' || $plate === '') {
            Response::error('Make, model and plate number are required.', 422);
        }

        if (strlen($make) > 100 || strlen($model) > 100 ||
            strlen($plate) > 30 || strlen($vin) > 100) {
            Response::error('One or more fields exceed the allowed length.', 422);
        }

        if ($year === false ||
            ($year !== null && ($year < 1886 || $year > (int) date('Y') + 1))) {
            Response::error('Invalid vehicle year.', 422);
        }

        $previous = [
            'make' => $vehicle['make'],
            'model' => $vehicle['model'],
            'year' => $vehicle['year'] === null ? null : (int) $vehicle['year'],
            'plate_number' => $vehicle['plate_number'],
            'vin' => $vehicle['vin']
        ];

        $updated = [
            'make' => $make,
            'model' => $model,
            'year' => $year,
            'plate_number' => $plate,
            'vin' => $vin === '' ? null : $vin
        ];

        if ($previous === $updated) {
            Response::success([], 'No vehicle details were changed.');
            return;
        }

        try {
            $db->beginTransaction();

            $check = $db->prepare(
                'SELECT id FROM vehicles WHERE plate_number = :plate AND id <> :id'
            );
            $check->execute([':plate' => $plate, ':id' => $id]);

            if ($check->fetch()) {
                $db->rollBack();
                Response::error('Registration number is already in use.', 409);
            }

            $stmt = $db->prepare(
                'UPDATE vehicles SET
                    make = :make,
                    model = :model,
                    year = :year,
                    plate_number = :plate,
                    vin = :vin,
                    updated_at = NOW()
                 WHERE id = :id'
            );

            $stmt->execute([
                ':make' => $make,
                ':model' => $model,
                ':year' => $year,
                ':plate' => $plate,
                ':vin' => $updated['vin'],
                ':id' => $id
            ]);

            $history = $db->prepare(
                'INSERT INTO vehicle_edit_history
                 (vehicle_id, edited_by, previous_value, new_value)
                 VALUES (:vehicle, :user, :previous, :updated)'
            );

            $history->execute([
                ':vehicle' => $id,
                ':user' => $payload['id'],
                ':previous' => json_encode($previous, JSON_THROW_ON_ERROR),
                ':updated' => json_encode($updated, JSON_THROW_ON_ERROR)
            ]);

            $db->commit();
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            if ($e->getCode() === '23505') {
                Response::error('Registration number is already in use.', 409);
            }

            error_log($e->getMessage());
            Response::error('Could not update vehicle.', 500);
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            error_log($e->getMessage());
            Response::error('Could not update vehicle.', 500);
        }

        Response::success([], 'Vehicle details updated successfully.');
    }
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

