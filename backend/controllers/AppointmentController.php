<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class AppointmentController
{
    /** Rule 1 & 2: must be a logged-in customer with an existing, owned vehicle. */
    public static function create(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['customer']);

        $vehicleId = $body['vehicle_id'] ?? null;
        $serviceType = trim($body['service_type'] ?? '');
        $requestedDate = trim($body['requested_date'] ?? '');
        $notes = trim($body['notes'] ?? '');

        if (!$vehicleId || !$serviceType || !$requestedDate) {
            Response::error('Vehicle, service type and requested date/time are required.');
        }

        $db = Database::connect();
        $check = $db->prepare('SELECT id FROM vehicles WHERE id = :id AND customer_id = :cid');
        $check->execute([':id' => $vehicleId, ':cid' => $payload['id']]);
        if (!$check->fetch()) {
            Response::error('Selected vehicle was not found on your account. Please register the vehicle first.', 422);
        }

        $stmt = $db->prepare(
            'INSERT INTO appointments (customer_id, vehicle_id, service_type, requested_date, notes, status)
             VALUES (:cid, :vid, :service, :date, :notes, :status) RETURNING id'
        );
        $stmt->execute([
            ':cid' => $payload['id'], ':vid' => $vehicleId, ':service' => $serviceType,
            ':date' => $requestedDate, ':notes' => $notes ?: null, ':status' => 'Pending',
        ]);
        $id = $stmt->fetch()['id'];

        Audit::log($payload['id'], 'customer', 'Requested appointment', 'appointments', $id);
        Response::success(['id' => $id], 'Appointment requested. Awaiting confirmation.', 201);
    }

    public static function list(): void
    {
        $payload = require_auth();
        $db = Database::connect();

        if ($payload['role'] === 'customer') {
            $stmt = $db->prepare(
                'SELECT a.*, v.make, v.model, v.plate_number FROM appointments a
                 JOIN vehicles v ON v.id = a.vehicle_id WHERE a.customer_id = :cid ORDER BY a.requested_date DESC'
            );
            $stmt->execute([':cid' => $payload['id']]);
        } else {
            $stmt = $db->query(
                'SELECT a.*, v.make, v.model, v.plate_number, u.name AS customer_name
                 FROM appointments a
                 JOIN vehicles v ON v.id = a.vehicle_id
                 JOIN users u ON u.id = a.customer_id
                 ORDER BY a.requested_date DESC'
            );
        }
        Response::success($stmt->fetchAll());
    }

    /** Rule 4: only Garage Administrator (or manager) can confirm/reschedule/cancel. */
    public static function updateStatus(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $status = $body['status'] ?? '';
        $allowed = ['Pending', 'Confirmed', 'Arrived', 'Cancelled', 'No-show'];
        if (!in_array($status, $allowed, true)) {
            Response::error('Invalid status.');
        }

        $db = Database::connect();
        $stmt = $db->prepare('SELECT * FROM appointments WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $appt = $stmt->fetch();
        if (!$appt) {
            Response::error('Appointment not found.', 404);
        }

        // Rule 3: cannot confirm without valid date/time and service type (already enforced at creation),
        // and a rescheduled date can optionally be supplied.
        $newDate = $body['requested_date'] ?? $appt['requested_date'];

        $upd = $db->prepare(
            'UPDATE appointments SET status = :status, requested_date = :date, confirmed_by = :by WHERE id = :id'
        );
        $upd->execute([':status' => $status, ':date' => $newDate, ':by' => $payload['id'], ':id' => $id]);

        Audit::log($payload['id'], $payload['role'], "Appointment status -> $status", 'appointments', $id, ['status' => $appt['status']], ['status' => $status]);

        Response::success([], "Appointment marked as $status.");
    }

    /** Rule 5: convert a confirmed/arrived appointment into a job card (walk-in vehicle check-in). */
    public static function convertToJob(int $id): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $stmt = $db->prepare('SELECT * FROM appointments WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $appt = $stmt->fetch();
        if (!$appt) {
            Response::error('Appointment not found.', 404);
        }
        if (!in_array($appt['status'], ['Confirmed', 'Arrived'], true)) {
            Response::error('Only confirmed or arrived appointments can be converted into a job card.', 422);
        }

        $jobNumber = 'JOB-' . date('Ymd') . '-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);

        $ins = $db->prepare(
            'INSERT INTO job_cards (job_number, customer_id, vehicle_id, appointment_id, reported_problem, status)
             VALUES (:num, :cid, :vid, :aid, :problem, :status) RETURNING id'
        );
        $ins->execute([
            ':num' => $jobNumber, ':cid' => $appt['customer_id'], ':vid' => $appt['vehicle_id'],
            ':aid' => $appt['id'], ':problem' => $appt['service_type'], ':status' => 'Vehicle Checked In',
        ]);
        $jobId = $ins->fetch()['id'];

        $upd = $db->prepare("UPDATE appointments SET status = 'Arrived' WHERE id = :id");
        $upd->execute([':id' => $id]);

        Audit::log($payload['id'], $payload['role'], 'Converted appointment to job card', 'job_cards', $jobId);

        Response::success(['job_id' => $jobId, 'job_number' => $jobNumber], 'Job card created from appointment.', 201);
    }
}
