<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../helpers/InvoiceHelper.php';

class InvoiceController
{
    /** Generate an invoice from a verified/ready job (labour charges are entered by admin). */
    public static function createFromJob(int $jobId, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $extraLabour = $body['labour_charge'] ?? 0;
        $discount = $body['discount'] ?? 0;
        if (!is_numeric($extraLabour) || !is_numeric($discount) || (float) $extraLabour < 0 || (float) $discount < 0) {
            Response::error('Labour and discount must be non-negative amounts.', 422);
        }

        $db = Database::connect();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('SELECT * FROM job_cards WHERE id = :id FOR UPDATE');
            $stmt->execute([':id' => $jobId]);
            $job = $stmt->fetch();
            if (!$job) {
                $db->rollBack();
                Response::error('Job not found.', 404);
            }
            if ($job['status'] !== 'Ready for Collection') {
                $db->rollBack();
                Response::error('Only verified jobs ready for collection can be invoiced.', 422);
            }
            $check = $db->prepare('SELECT id FROM invoices WHERE job_id = :id LIMIT 1');
            $check->execute([':id' => $jobId]);
            if ($check->fetch()) {
                $db->rollBack();
                Response::error('An invoice already exists for this job.', 409);
            }
            $parts = $db->prepare('SELECT COALESCE(SUM(quantity * unit_price), 0) FROM job_parts WHERE job_id = :id');
            $parts->execute([':id' => $jobId]);
            $partsTotal = (float) $parts->fetchColumn();
            $services = $db->prepare('SELECT COALESCE(SUM(quantity * unit_price), 0) FROM job_services WHERE job_id = :id');
            $services->execute([':id' => $jobId]);
            $servicesTotal = (float) $services->fetchColumn();
            $subtotal = round($partsTotal + $servicesTotal + (float) $extraLabour, 2);
            $discountAmount = round((float) $discount, 2);
            if ($discountAmount > $subtotal) {
                $db->rollBack();
                Response::error('Discount cannot exceed the subtotal.', 422);
            }
            $total = round($subtotal - $discountAmount, 2);
            $number = 'INV-' . date('Ymd') . '-' . bin2hex(random_bytes(4));
            $insert = $db->prepare("INSERT INTO invoices (invoice_number, source_type, job_id, customer_id, subtotal, discount, total, status) VALUES (:num, 'job', :jid, :cid, :subtotal, :discount, :total, 'Unpaid')");
            $insert->execute([':num' => $number, ':jid' => $jobId, ':cid' => $job['customer_id'], ':subtotal' => $subtotal, ':discount' => $discountAmount, ':total' => $total]);
            $id = (int) $db->lastInsertId();
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }

        Audit::log($payload['id'], $payload['role'], 'Generated invoice from job', 'invoices', $id);
        Response::success(['id' => $id, 'invoice_number' => $number, 'parts_total' => $partsTotal, 'services_total' => $servicesTotal, 'additional_labour' => (float) $extraLabour, 'subtotal' => $subtotal, 'discount' => $discountAmount, 'total' => $total], 'Invoice generated.', 201);
    }

    public static function createFromOrder(int $orderId): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        try {
            $invoice = InvoiceHelper::ensureForOrder($db, $orderId);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 404);
        }

        Response::success(['id' => $invoice['id'], 'invoice_number' => $invoice['invoice_number']], 'Invoice ready.', 201);
    }

    public static function list(): void
    {
        $payload = require_auth();
        require_role($payload, ['customer', 'admin', 'manager']);
        $db = Database::connect();

        if ($payload['role'] === 'customer') {
            $stmt = $db->prepare('SELECT * FROM invoices WHERE customer_id = :cid ORDER BY created_at DESC');
            $stmt->execute([':cid' => $payload['id']]);
        } else {
            $stmt = $db->query('SELECT i.*, u.name AS customer_name FROM invoices i JOIN users u ON u.id = i.customer_id ORDER BY i.created_at DESC');
        }
        $invoices = $stmt->fetchAll();

        foreach ($invoices as &$inv) {
            $paid = $db->prepare('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = :id');
            $paid->execute([':id' => $inv['id']]);
            $inv['amount_paid'] = (float) $paid->fetch()['paid'];
            $inv['balance'] = (float) $inv['total'] - $inv['amount_paid'];
            if ($inv['job_id']) {
                $services = $db->prepare('SELECT js.description, js.quantity, js.unit_price, s.name AS service_name FROM job_services js JOIN services s ON s.id = js.service_id WHERE js.job_id = :id ORDER BY js.id');
                $services->execute([':id' => $inv['job_id']]);
                $inv['service_items'] = $services->fetchAll();
                $parts = $db->prepare('SELECT p.name AS part_name, jp.quantity, jp.unit_price FROM job_parts jp JOIN parts p ON p.id = jp.part_id WHERE jp.job_id = :id ORDER BY jp.id');
                $parts->execute([':id' => $inv['job_id']]);
                $inv['part_items'] = $parts->fetchAll();
                $itemsTotal = array_reduce($inv['service_items'], fn($t, $x) => $t + (float) $x['quantity'] * (float) $x['unit_price'], 0.0);
                $itemsTotal += array_reduce($inv['part_items'], fn($t, $x) => $t + (float) $x['quantity'] * (float) $x['unit_price'], 0.0);
                $inv['additional_labour'] = round((float) $inv['subtotal'] - $itemsTotal, 2);
            }
        }

        Response::success($invoices);
    }

    /** Record a payment. Prevents overpayment beyond the balance. */
    public static function recordPayment(int $invoiceId, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $amount = $body['amount'] ?? null;
        $method = trim((string) ($body['method'] ?? 'Cash'));
        if (!is_numeric($amount) || (float) $amount <= 0 || !in_array($method, ['Cash', 'Bank Transfer', 'Mobile Money', 'Card'], true)) {
            Response::error('A positive payment amount and valid payment method are required.', 422);
        }
        if (abs(round((float) $amount, 2) - (float) $amount) > 0.00001) {
            Response::error('Payment amounts must have no more than two decimal places.', 422);
        }

        $db = Database::connect();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('SELECT * FROM invoices WHERE id = :id FOR UPDATE');
            $stmt->execute([':id' => $invoiceId]);
            $invoice = $stmt->fetch();
            if (!$invoice) {
                $db->rollBack();
                Response::error('Invoice not found.', 404);
            }
            if (in_array($invoice['status'], ['Cancelled', 'Refunded'], true)) {
                $db->rollBack();
                Response::error('Payments cannot be recorded on this invoice.', 422);
            }
            $sum = $db->prepare('SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id = :id');
            $sum->execute([':id' => $invoiceId]);
            $alreadyPaid = (float) $sum->fetchColumn();
            $balance = round((float) $invoice['total'] - $alreadyPaid, 2);
            $payment = round((float) $amount, 2);
            if ($payment > $balance || $balance <= 0) {
                $db->rollBack();
                Response::error('Payment exceeds the outstanding balance.', 422);
            }
            $insert = $db->prepare('INSERT INTO payments (invoice_id, amount, method, recorded_by) VALUES (:iid, :amount, :method, :by)');
            $insert->execute([':iid' => $invoiceId, ':amount' => $payment, ':method' => $method, ':by' => $payload['id']]);
            $remaining = round($balance - $payment, 2);
            $status = $remaining <= 0 ? 'Paid' : 'Partially Paid';
            $update = $db->prepare('UPDATE invoices SET status = :status WHERE id = :id');
            $update->execute([':status' => $status, ':id' => $invoiceId]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }

        Audit::log($payload['id'], $payload['role'], 'Recorded payment', 'invoices', $invoiceId, null, ['amount' => $payment, 'method' => $method]);
        Response::success(['status' => $status, 'balance' => $remaining], 'Payment recorded.');
    }

    /** Cancel/reverse instead of deleting - keeps financial history auditable. */
    public static function cancel(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['manager']); // manager approval required per spec table

        $reason = trim($body['reason'] ?? '');
        if (!$reason) {
            Response::error('A reason is required to cancel an invoice.');
        }

        $db = Database::connect();
        $upd = $db->prepare("UPDATE invoices SET status = 'Cancelled' WHERE id = :id");
        $upd->execute([':id' => $id]);

        Audit::log($payload['id'], 'manager', 'Cancelled invoice', 'invoices', $id, null, null, $reason);
        Response::success([], 'Invoice cancelled.');
    }
}
