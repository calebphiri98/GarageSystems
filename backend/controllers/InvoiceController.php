<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class InvoiceController
{
    /** Generate an invoice from a verified/ready job (labour charges are entered by admin). */
    public static function createFromJob(int $jobId, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $labourCharge = (float) ($body['labour_charge'] ?? 0);
        $discount = (float) ($body['discount'] ?? 0);

        $db = Database::connect();
        $job = $db->prepare('SELECT * FROM job_cards WHERE id = :id');
        $job->execute([':id' => $jobId]);
        $jobRow = $job->fetch();
        if (!$jobRow) {
            Response::error('Job not found.', 404);
        }

        $existing = $db->prepare('SELECT id FROM invoices WHERE job_id = :id');
        $existing->execute([':id' => $jobId]);
        if ($existing->fetch()) {
            Response::error('An invoice already exists for this job.', 409);
        }

        $parts = $db->prepare('SELECT SUM(quantity * unit_price) AS total FROM job_parts WHERE job_id = :id');
        $parts->execute([':id' => $jobId]);
        $partsTotal = (float) ($parts->fetch()['total'] ?? 0);

        $subtotal = $labourCharge + $partsTotal;
        $total = max(0, $subtotal - $discount);
        $invoiceNumber = 'INV-' . date('Ymd') . '-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);

        $stmt = $db->prepare(
            "INSERT INTO invoices (invoice_number, source_type, job_id, customer_id, subtotal, discount, total, status)
             VALUES (:num, 'job', :jid, :cid, :subtotal, :discount, :total, 'Unpaid') RETURNING id"
        );
        $stmt->execute([
            ':num' => $invoiceNumber, ':jid' => $jobId, ':cid' => $jobRow['customer_id'],
            ':subtotal' => $subtotal, ':discount' => $discount, ':total' => $total,
        ]);
        $id = $stmt->fetch()['id'];

        Audit::log($payload['id'], $payload['role'], 'Generated invoice from job', 'invoices', $id);
        Response::success(['id' => $id, 'invoice_number' => $invoiceNumber, 'total' => $total], 'Invoice generated.', 201);
    }

    public static function createFromOrder(int $orderId): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $order = $db->prepare('SELECT * FROM orders WHERE id = :id');
        $order->execute([':id' => $orderId]);
        $orderRow = $order->fetch();
        if (!$orderRow) {
            Response::error('Order not found.', 404);
        }

        $items = $db->prepare('SELECT SUM(quantity * unit_price) AS total FROM order_items WHERE order_id = :id');
        $items->execute([':id' => $orderId]);
        $subtotal = (float) ($items->fetch()['total'] ?? 0);
        $invoiceNumber = 'INV-' . date('Ymd') . '-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);

        $stmt = $db->prepare(
            "INSERT INTO invoices (invoice_number, source_type, order_id, customer_id, subtotal, discount, total, status)
             VALUES (:num, 'order', :oid, :cid, :subtotal, 0, :subtotal, 'Unpaid') RETURNING id"
        );
        $stmt->execute([':num' => $invoiceNumber, ':oid' => $orderId, ':cid' => $orderRow['customer_id'], ':subtotal' => $subtotal]);
        $id = $stmt->fetch()['id'];

        Audit::log($payload['id'], $payload['role'], 'Generated invoice from order', 'invoices', $id);
        Response::success(['id' => $id, 'invoice_number' => $invoiceNumber], 'Invoice generated.', 201);
    }

    public static function list(): void
    {
        $payload = require_auth();
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
        }

        Response::success($invoices);
    }

    /** Record a payment. Prevents overpayment beyond the balance. */
    public static function recordPayment(int $invoiceId, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $amount = (float) ($body['amount'] ?? 0);
        $method = trim($body['method'] ?? 'Cash');
        if ($amount <= 0) {
            Response::error('Payment amount must be greater than zero.');
        }

        $db = Database::connect();
        $inv = $db->prepare('SELECT * FROM invoices WHERE id = :id');
        $inv->execute([':id' => $invoiceId]);
        $invoice = $inv->fetch();
        if (!$invoice) {
            Response::error('Invoice not found.', 404);
        }
        if ($invoice['status'] === 'Cancelled') {
            Response::error('Cannot record a payment against a cancelled invoice.', 422);
        }

        $paidSoFar = $db->prepare('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = :id');
        $paidSoFar->execute([':id' => $invoiceId]);
        $alreadyPaid = (float) $paidSoFar->fetch()['paid'];
        $balance = (float) $invoice['total'] - $alreadyPaid;

        if ($amount > $balance + 0.01) {
            Response::error("Payment exceeds the outstanding balance of $balance. Use a refund/overpayment process instead.", 422);
        }

        $db->beginTransaction();
        $ins = $db->prepare('INSERT INTO payments (invoice_id, amount, method, recorded_by) VALUES (:iid, :amount, :method, :by)');
        $ins->execute([':iid' => $invoiceId, ':amount' => $amount, ':method' => $method, ':by' => $payload['id']]);

        $newPaidTotal = $alreadyPaid + $amount;
        $newStatus = $newPaidTotal >= (float) $invoice['total'] ? 'Paid' : 'Partially Paid';
        $upd = $db->prepare('UPDATE invoices SET status = :status WHERE id = :id');
        $upd->execute([':status' => $newStatus, ':id' => $invoiceId]);
        $db->commit();

        Audit::log($payload['id'], $payload['role'], 'Recorded payment', 'invoices', $invoiceId, null, ['amount' => $amount]);
        Response::success(['status' => $newStatus], 'Payment recorded.');
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
