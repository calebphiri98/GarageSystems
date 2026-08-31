<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class JobController
{
    /** Admin creates a walk-in job card directly (no appointment). */
    public static function create(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $vehicleId = $body['vehicle_id'] ?? null;
        $problem = trim($body['reported_problem'] ?? '');
        if (!$vehicleId || !$problem) {
            Response::error('Vehicle and reported problem are required.');
        }

        $db = Database::connect();
        $v = $db->prepare('SELECT customer_id FROM vehicles WHERE id = :id');
        $v->execute([':id' => $vehicleId]);
        $vehicle = $v->fetch();
        if (!$vehicle) {
            Response::error('Vehicle not found. Please register the vehicle before creating a job.', 422);
        }

        $jobNumber = 'JOB-' . date('Ymd') . '-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
        $stmt = $db->prepare(
            'INSERT INTO job_cards (job_number, customer_id, vehicle_id, reported_problem, status)
             VALUES (:num, :cid, :vid, :problem, :status) RETURNING id'
        );
        $stmt->execute([
            ':num' => $jobNumber, ':cid' => $vehicle['customer_id'], ':vid' => $vehicleId,
            ':problem' => $problem, ':status' => 'Vehicle Checked In',
        ]);
        $id = $stmt->fetch()['id'];

        Audit::log($payload['id'], $payload['role'], 'Created walk-in job card', 'job_cards', $id);
        Response::success(['id' => $id, 'job_number' => $jobNumber], 'Job card created.', 201);
    }

    /** Admin allocates duties: assigns/reassigns a mechanic to a job. */
    public static function assignMechanic(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $mechanicId = $body['mechanic_id'] ?? null;
        if (!$mechanicId) {
            Response::error('mechanic_id is required.');
        }

        $db = Database::connect();
        $m = $db->prepare("SELECT id, name FROM users WHERE id = :id AND role = 'mechanic' AND is_active = TRUE");
        $m->execute([':id' => $mechanicId]);
        $mechanic = $m->fetch();
        if (!$mechanic) {
            Response::error('Selected mechanic was not found or is inactive.', 422);
        }

        $job = $db->prepare('SELECT status FROM job_cards WHERE id = :id');
        $job->execute([':id' => $id]);
        $jobRow = $job->fetch();
        if (!$jobRow) {
            Response::error('Job card not found.', 404);
        }

        $newStatus = $jobRow['status'] === 'Vehicle Checked In' ? 'Inspection' : $jobRow['status'];
        $upd = $db->prepare('UPDATE job_cards SET assigned_mechanic_id = :mid, status = :status WHERE id = :id');
        $upd->execute([':mid' => $mechanicId, ':status' => $newStatus, ':id' => $id]);

        $notify = $db->prepare('INSERT INTO notifications (user_id, message) VALUES (:uid, :msg)');
        $notify->execute([':uid' => $mechanicId, ':msg' => "You have been assigned a new job card (#$id)."]);

        Audit::log($payload['id'], $payload['role'], "Assigned mechanic {$mechanic['name']} to job", 'job_cards', $id);
        Response::success([], "{$mechanic['name']} assigned to this job.");
    }

    public static function list(): void
    {
        $payload = require_auth();
        $db = Database::connect();

        $base = 'SELECT j.*, v.make, v.model, v.plate_number, c.name AS customer_name, m.name AS mechanic_name
                  FROM job_cards j
                  JOIN vehicles v ON v.id = j.vehicle_id
                  JOIN users c ON c.id = j.customer_id
                  LEFT JOIN users m ON m.id = j.assigned_mechanic_id';

        if ($payload['role'] === 'customer') {
            $stmt = $db->prepare("$base WHERE j.customer_id = :id ORDER BY j.opened_at DESC");
            $stmt->execute([':id' => $payload['id']]);
        } elseif ($payload['role'] === 'mechanic') {
            // "Mechanic should have their own page where they can see the work assigned to them"
            $stmt = $db->prepare("$base WHERE j.assigned_mechanic_id = :id ORDER BY j.opened_at DESC");
            $stmt->execute([':id' => $payload['id']]);
        } else {
            $stmt = $db->query("$base ORDER BY j.opened_at DESC");
        }
        Response::success($stmt->fetchAll());
    }

    public static function get(int $id): void
    {
        $payload = require_auth();
        $db = Database::connect();

        $stmt = $db->prepare(
            'SELECT j.*, v.make, v.model, v.plate_number, v.vin, c.name AS customer_name, c.phone AS customer_phone,
                    m.name AS mechanic_name
             FROM job_cards j
             JOIN vehicles v ON v.id = j.vehicle_id
             JOIN users c ON c.id = j.customer_id
             LEFT JOIN users m ON m.id = j.assigned_mechanic_id
             WHERE j.id = :id'
        );
        $stmt->execute([':id' => $id]);
        $job = $stmt->fetch();
        if (!$job) {
            Response::error('Job not found.', 404);
        }

        if ($payload['role'] === 'customer' && $job['customer_id'] != $payload['id']) {
            Response::error('You do not have access to this job.', 403);
        }
        if ($payload['role'] === 'mechanic' && $job['assigned_mechanic_id'] != $payload['id']) {
            Response::error('This job is not assigned to you.', 403);
        }

        $parts = $db->prepare(
            'SELECT jp.*, p.name AS part_name, p.sku FROM job_parts jp JOIN parts p ON p.id = jp.part_id WHERE jp.job_id = :id'
        );
        $parts->execute([':id' => $id]);
        $job['parts_used'] = $parts->fetchAll();

        $approvals = $db->prepare('SELECT * FROM job_approvals WHERE job_id = :id ORDER BY requested_at DESC');
        $approvals->execute([':id' => $id]);
        $job['approvals'] = $approvals->fetchAll();

        Response::success($job);
    }

    /**
     * Mechanic updates status / diagnosis / work performed as they progress.
     * This is the "mechanic gives the status of the work" requirement.
     */
    public static function updateByMechanic(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['mechanic']);

        $db = Database::connect();
        $stmt = $db->prepare('SELECT * FROM job_cards WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $job = $stmt->fetch();
        if (!$job) {
            Response::error('Job not found.', 404);
        }
        if ($job['assigned_mechanic_id'] != $payload['id']) {
            Response::error('This job is not assigned to you.', 403);
        }

        $allowedStatuses = ['Inspection', 'In Progress', 'Waiting for Parts', 'Completed'];
        $status = $body['status'] ?? $job['status'];
        if (!in_array($status, $allowedStatuses, true)) {
            Response::error('Invalid status for a mechanic to set.');
        }

        $diagnosis = $body['diagnosis'] ?? $job['diagnosis'];
        $workPerformed = $body['work_performed'] ?? $job['work_performed'];
        $completionNotes = $body['completion_notes'] ?? $job['completion_notes'];

        // Mechanic completion rule: cannot mark Completed without diagnosis, work performed and completion notes.
        if ($status === 'Completed' && (!$diagnosis || !$workPerformed || !$completionNotes)) {
            Response::error('Diagnosis, work performed and completion notes are all required before marking a job Completed.', 422);
        }

        $upd = $db->prepare(
            'UPDATE job_cards SET status = :status, diagnosis = :diagnosis, work_performed = :work, completion_notes = :notes
             WHERE id = :id'
        );
        $upd->execute([
            ':status' => $status, ':diagnosis' => $diagnosis, ':work' => $workPerformed,
            ':notes' => $completionNotes, ':id' => $id,
        ]);

        Audit::log($payload['id'], 'mechanic', "Updated job status -> $status", 'job_cards', $id, ['status' => $job['status']], ['status' => $status]);

        $notify = $db->prepare('INSERT INTO notifications (user_id, message) VALUES (:uid, :msg)');
        $notify->execute([':uid' => $job['customer_id'], ':msg' => "Your job #{$job['job_number']} status: $status"]);

        Response::success([], 'Job updated.');
    }

    /** Mechanic (or admin) raises an approval request for extra work found during inspection. */
    public static function requestApproval(int $jobId, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['mechanic', 'admin']);

        $description = trim($body['description'] ?? '');
        $cost = $body['estimated_cost'] ?? 0;
        if (!$description) {
            Response::error('Description of the additional work is required.');
        }

        $db = Database::connect();
        $stmt = $db->prepare(
            'INSERT INTO job_approvals (job_id, description, estimated_cost) VALUES (:jid, :desc, :cost) RETURNING id'
        );
        $stmt->execute([':jid' => $jobId, ':desc' => $description, ':cost' => $cost]);
        $id = $stmt->fetch()['id'];

        $upd = $db->prepare("UPDATE job_cards SET status = 'Awaiting Approval' WHERE id = :id");
        $upd->execute([':id' => $jobId]);

        Audit::log($payload['id'], $payload['role'], 'Requested customer approval for extra work', 'job_approvals', $id);
        Response::success(['id' => $id], 'Approval request created. Job marked Awaiting Approval.', 201);
    }

    /** Customer approves or rejects extra work. */
    public static function decideApproval(int $approvalId, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['customer']);

        $decision = $body['decision'] ?? '';
        if (!in_array($decision, ['Approved', 'Rejected'], true)) {
            Response::error('Decision must be Approved or Rejected.');
        }

        $db = Database::connect();
        $stmt = $db->prepare('SELECT ja.*, j.customer_id FROM job_approvals ja JOIN job_cards j ON j.id = ja.job_id WHERE ja.id = :id');
        $stmt->execute([':id' => $approvalId]);
        $approval = $stmt->fetch();
        if (!$approval) {
            Response::error('Approval request not found.', 404);
        }
        if ($approval['customer_id'] != $payload['id']) {
            Response::error('This approval request does not belong to you.', 403);
        }

        $upd = $db->prepare('UPDATE job_approvals SET status = :status, decided_at = NOW() WHERE id = :id');
        $upd->execute([':status' => $decision, ':id' => $approvalId]);

        $newJobStatus = $decision === 'Approved' ? 'Approved' : 'In Progress';
        $updJob = $db->prepare('UPDATE job_cards SET status = :status WHERE id = :id');
        $updJob->execute([':status' => $newJobStatus, ':id' => $approval['job_id']]);

        Audit::log($payload['id'], 'customer', "Approval $decision", 'job_approvals', $approvalId);
        Response::success([], "Additional work $decision.");
    }

    /** Admin verifies a completed job before invoicing (workflow step 14). */
    public static function verify(int $id): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $stmt = $db->prepare('SELECT status FROM job_cards WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $job = $stmt->fetch();
        if (!$job) {
            Response::error('Job not found.', 404);
        }
        if ($job['status'] !== 'Completed') {
            Response::error('Only a Completed job can be verified.', 422);
        }

        $upd = $db->prepare("UPDATE job_cards SET status = 'Ready for Collection', verified_by = :by WHERE id = :id");
        $upd->execute([':by' => $payload['id'], ':id' => $id]);

        Audit::log($payload['id'], $payload['role'], 'Verified completed job', 'job_cards', $id);
        Response::success([], 'Job verified. Vehicle marked Ready for Collection.');
    }

    /** Final step: mark vehicle collected and close the job. */
    public static function closeJob(int $id): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $stmt = $db->prepare('SELECT status FROM job_cards WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $job = $stmt->fetch();
        if (!$job) {
            Response::error('Job not found.', 404);
        }
        if ($job['status'] !== 'Ready for Collection') {
            Response::error('Job must be Ready for Collection before it can be closed.', 422);
        }

        $upd = $db->prepare("UPDATE job_cards SET status = 'Collected', closed_at = NOW() WHERE id = :id");
        $upd->execute([':id' => $id]);

        Audit::log($payload['id'], $payload['role'], 'Closed job / vehicle collected', 'job_cards', $id);
        Response::success([], 'Vehicle marked as collected. Job closed.');
    }

    /** Record parts used on a job (updates inventory too). */
    public static function usePart(int $jobId, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['mechanic', 'admin']);

        $partId = $body['part_id'] ?? null;
        $qty = (int) ($body['quantity'] ?? 0);
        if (!$partId || $qty <= 0) {
            Response::error('part_id and a positive quantity are required.');
        }

        $db = Database::connect();
        $db->beginTransaction();
        try {
            $part = $db->prepare('SELECT * FROM parts WHERE id = :id FOR UPDATE');
            $part->execute([':id' => $partId]);
            $partRow = $part->fetch();
            if (!$partRow) {
                throw new Exception('Part not found.');
            }
            if ($partRow['quantity'] < $qty) {
                throw new Exception("Not enough stock. Only {$partRow['quantity']} units of {$partRow['name']} available.");
            }

            $upd = $db->prepare('UPDATE parts SET quantity = quantity - :qty WHERE id = :id');
            $upd->execute([':qty' => $qty, ':id' => $partId]);

            $ins = $db->prepare(
                'INSERT INTO job_parts (job_id, part_id, quantity, unit_price) VALUES (:jid, :pid, :qty, :price)'
            );
            $ins->execute([':jid' => $jobId, ':pid' => $partId, ':qty' => $qty, ':price' => $partRow['unit_price']]);

            $mv = $db->prepare(
                "INSERT INTO stock_movements (part_id, type, quantity, reference_job_id, created_by)
                 VALUES (:pid, 'used', :qty, :jid, :uid)"
            );
            $mv->execute([':pid' => $partId, ':qty' => $qty, ':jid' => $jobId, ':uid' => $payload['id']]);

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 422);
        }

        Audit::log($payload['id'], $payload['role'], 'Recorded part used on job', 'job_parts', $jobId);
        Response::success([], 'Part usage recorded and stock updated.');
    }
}
