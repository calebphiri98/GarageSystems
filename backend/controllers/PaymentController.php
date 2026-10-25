<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/InvoiceHelper.php';
require_once __DIR__ . '/../middleware/auth.php';

/**
 * PayChangu online payments.
 *
 *   POST /payments/initiate  { order_id | invoice_id }  -> { checkout_url, tx_ref }
 *   POST /payments/verify    { tx_ref }                 -> called by the page the customer returns to
 *   POST /payments/webhook                              -> called by PayChangu (server to server)
 *
 * The amount is always taken from the invoice in the database. A payment is only
 * recorded after WE ask PayChangu to confirm it - the browser redirect proves nothing.
 * verify and webhook both go through finalize(), which is safe to run any number of times.
 */
class PaymentController
{
    private const API = 'https://api.paychangu.com';

    private static function secretKey(): string
    {
        $key = trim((string) env('PAYCHANGU_SECRET_KEY', ''));
        if ($key === '') {
            Response::error('Online payment is not configured yet.', 503);
        }
        return $key;
    }

    /** Call the PayChangu API. Returns ['ok', 'code', 'body', 'error']. */
    private static function gateway(string $method, string $path, ?array $json = null): array
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'code' => 0, 'body' => null, 'error' => 'The PHP cURL extension is not enabled.'];
        }

        $headers = ['Authorization: Bearer ' . self::secretKey(), 'Accept: application/json'];
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CUSTOMREQUEST => $method,
        ];
        if ($json !== null) {
            $headers[] = 'Content-Type: application/json';
            $opts[CURLOPT_POSTFIELDS] = json_encode($json);
        }
        $opts[CURLOPT_HTTPHEADER] = $headers;

        // Windows PHP often has no CA bundle - set CURL_CA_BUNDLE in .env if you get an SSL error.
        $ca = env('CURL_CA_BUNDLE');
        if ($ca) {
            $opts[CURLOPT_CAINFO] = $ca;
        }

        $ch = curl_init(self::API . $path);
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($raw === false) {
            return ['ok' => false, 'code' => 0, 'body' => null, 'error' => $err ?: 'Request failed.'];
        }
        return ['ok' => true, 'code' => $code, 'body' => json_decode($raw, true), 'error' => null];
    }

    private static function amountPaid(PDO $db, int $invoiceId): float
    {
        $q = $db->prepare('SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = :id');
        $q->execute([':id' => $invoiceId]);
        return (float) $q->fetchColumn();
    }

    /** POST /payments/initiate */
    public static function initiate(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['customer']);

        $db = Database::connect();
        $orderId = (int) ($body['order_id'] ?? 0);
        $invoiceId = (int) ($body['invoice_id'] ?? 0);

        if ($orderId) {
            $o = $db->prepare('SELECT id, customer_id FROM orders WHERE id = :id');
            $o->execute([':id' => $orderId]);
            $order = $o->fetch();
            if (!$order || (int) $order['customer_id'] !== (int) $payload['id']) {
                Response::error('Order not found.', 404);
            }
            $invoice = InvoiceHelper::ensureForOrder($db, $orderId);
        } elseif ($invoiceId) {
            $q = $db->prepare('SELECT * FROM invoices WHERE id = :id AND customer_id = :cid');
            $q->execute([':id' => $invoiceId, ':cid' => $payload['id']]);
            $invoice = $q->fetch();
            if (!$invoice) {
                Response::error('Invoice not found.', 404);
            }
        } else {
            Response::error('An order or invoice is required.');
        }

        if ($invoice['order_id']) {
            $os = $db->prepare('SELECT status FROM orders WHERE id = :id');
            $os->execute([':id' => $invoice['order_id']]);
            if ($os->fetchColumn() !== 'Pending') {
                Response::error('This order can no longer be paid.', 422);
            }
        }

        if ($invoice['status'] === 'Paid') {
            Response::error('This invoice is already paid.', 422);
        }
        if (in_array($invoice['status'], ['Cancelled', 'Refunded'], true)) {
            Response::error('This invoice can no longer be paid.', 422);
        }

        $balance = round((float) $invoice['total'] - self::amountPaid($db, (int) $invoice['id']), 2);
        if ($balance <= 0) {
            Response::error('There is no balance to pay on this invoice.', 422);
        }

        $u = $db->prepare('SELECT name, email FROM users WHERE id = :id');
        $u->execute([':id' => $payload['id']]);
        $user = $u->fetch();
        $nameParts = preg_split('/\s+/', trim($user['name']), 2);
        $first = $nameParts[0] ?: 'Customer';
        $last = $nameParts[1] ?? 'Customer';

        $txRef = 'UG' . $invoice['id'] . '-' . strtoupper(bin2hex(random_bytes(5)));

        $ins = $db->prepare(
            "INSERT INTO payment_attempts (tx_ref, invoice_id, customer_id, amount, currency, status)
             VALUES (:ref, :iid, :cid, :amount, 'MWK', 'pending') RETURNING id"
        );
        $ins->execute([':ref' => $txRef, ':iid' => $invoice['id'], ':cid' => $payload['id'], ':amount' => $balance]);
        $attemptId = $ins->fetch()['id'];

        $frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/');

        $res = self::gateway('POST', '/payment', [
            'amount' => $balance,
            'currency' => 'MWK',
            'email' => $user['email'],
            'first_name' => $first,
            'last_name' => $last,
            'tx_ref' => $txRef,
            'callback_url' => $frontend . '/customer/payment/result/' . rawurlencode($txRef),
            'return_url' => $frontend . '/customer/invoices?payment=cancelled',
            'customization' => [
                'title' => 'Uptown Garage',
                'description' => 'Payment for invoice ' . $invoice['invoice_number'],
            ],
        ]);

        $b = is_array($res['body']) ? $res['body'] : [];

        if (!$res['ok']) {
            self::markAttempt($db, $attemptId, 'failed', ['error' => $res['error']]);
            Response::error('Could not reach the payment provider: ' . $res['error'], 502);
        }

        $checkoutUrl = $b['data']['checkout_url'] ?? null;
        if (($b['status'] ?? '') !== 'success' || !$checkoutUrl) {
            self::markAttempt($db, $attemptId, 'failed', $b);
            $msg = $b['message'] ?? 'The payment provider rejected the request.';
            Response::error('Payment could not be started: ' . (is_string($msg) ? $msg : json_encode($msg)), 502);
        }

        Response::success(
            ['checkout_url' => $checkoutUrl, 'tx_ref' => $txRef, 'amount' => $balance],
            'Redirecting to payment.'
        );
    }

    /** POST /payments/verify - used by the page the customer returns to after paying. */
    public static function verify(array $body): void
    {
        $payload = require_auth();

        $txRef = trim((string) ($body['tx_ref'] ?? ''));
        if ($txRef === '') {
            Response::error('tx_ref is required.');
        }

        $db = Database::connect();
        $q = $db->prepare('SELECT customer_id FROM payment_attempts WHERE tx_ref = :t');
        $q->execute([':t' => $txRef]);
        $attempt = $q->fetch();

        $isStaff = in_array($payload['role'], ['admin', 'manager'], true);
        if (!$attempt || (!$isStaff && (int) $attempt['customer_id'] !== (int) $payload['id'])) {
            Response::error('Payment not found.', 404);
        }

        Response::success(self::finalize($txRef));
    }

    /** POST /payments/webhook - PayChangu calls this when a payment completes. */
    public static function webhook(): void
    {
        $raw = file_get_contents('php://input');
        $secret = trim((string) env('PAYCHANGU_WEBHOOK_SECRET', ''));

        if ($secret !== '') {
            $sent = strtolower((string) ($_SERVER['HTTP_SIGNATURE'] ?? ''));
            $expected = hash_hmac('sha256', $raw, $secret);
            if (!hash_equals($expected, $sent)) {
                Response::error('Invalid signature.', 401);
            }
        } else {
            error_log('PayChangu webhook received with no PAYCHANGU_WEBHOOK_SECRET set - relying on re-verification only.');
        }

        $data = json_decode($raw, true) ?: [];
        $txRef = $data['tx_ref'] ?? $data['reference'] ?? null;

        if (is_string($txRef) && $txRef !== '') {
            try {
                self::finalize($txRef);
            } catch (Throwable $e) {
                error_log('Webhook finalize failed: ' . $e->getMessage());
            }
        }

        // Always answer 200 so PayChangu does not keep retrying.
        Response::success([], 'Received.');
    }

    /**
     * Ask PayChangu whether this payment succeeded and, if so, record it exactly once.
     * state: success | pending | failed | review | error | unknown
     */
    public static function finalize(string $txRef): array
    {
        $db = Database::connect();
        $q = $db->prepare('SELECT * FROM payment_attempts WHERE tx_ref = :t');
        $q->execute([':t' => $txRef]);
        $attempt = $q->fetch();

        if (!$attempt) {
            return ['state' => 'unknown'];
        }
        if ($attempt['status'] === 'success') {
            return self::summary($db, $attempt, 'success');
        }
        if ($attempt['status'] === 'review') {
            return self::summary($db, $attempt, 'review');
        }

        $res = self::gateway('GET', '/verify-payment/' . rawurlencode($txRef));

        if (!$res['ok'] || !is_array($res['body'])) {
            error_log('PayChangu verify failed for ' . $txRef . ': ' . ($res['error'] ?? 'bad response'));
            return self::summary($db, $attempt, 'error');
        }

        // Unknown/not-yet-processed transaction - leave it pending.
        if ($res['code'] >= 400) {
            return self::summary($db, $attempt, 'pending');
        }

        $body = $res['body'];
        $data = is_array($body['data'] ?? null) ? $body['data'] : [];
        $gwStatus = strtolower((string) ($data['status'] ?? ''));

        if (($body['status'] ?? '') === 'success' && $gwStatus === 'success') {
            // The checks PayChangu recommends: reference, currency and amount must all match.
            $refOk = !isset($data['tx_ref']) || $data['tx_ref'] === $txRef;
            $currencyOk = !isset($data['currency']) || strtoupper((string) $data['currency']) === strtoupper($attempt['currency']);
            $amountOk = !isset($data['amount']) || ((float) $data['amount'] + 0.01 >= (float) $attempt['amount']);

            if (!$refOk || !$currencyOk || !$amountOk) {
                error_log("PayChangu mismatch for $txRef - flagged for review.");
                self::markAttempt($db, (int) $attempt['id'], 'review', $body);
                return self::summary($db, $attempt, 'review');
            }

            return self::recordSuccess($db, $attempt, $body, $data);
        }

        if (in_array($gwStatus, ['failed', 'cancelled', 'canceled'], true)) {
            self::markAttempt($db, (int) $attempt['id'], 'failed', $body);
            return self::summary($db, $attempt, 'failed');
        }

        return self::summary($db, $attempt, 'pending');
    }

    private static function recordSuccess(PDO $db, array $attempt, array $body, array $data): array
    {
        $invoice = null;

        $db->beginTransaction();
        try {
            $a = $db->prepare('SELECT * FROM payment_attempts WHERE id = :id FOR UPDATE');
            $a->execute([':id' => $attempt['id']]);
            $locked = $a->fetch();
            if ($locked['status'] === 'success') {
                $db->commit();
                return self::summary($db, $locked, 'success');
            }

            $i = $db->prepare('SELECT * FROM invoices WHERE id = :id FOR UPDATE');
            $i->execute([':id' => $attempt['invoice_id']]);
            $invoice = $i->fetch();

            if ($invoice['status'] === 'Cancelled') {
                $upd = $db->prepare("UPDATE payment_attempts SET status = 'review', gateway_response = :r, completed_at = now() WHERE id = :id");
                $upd->execute([':r' => json_encode($body), ':id' => $attempt['id']]);
                $db->commit();
                error_log("PayChangu payment {$attempt['tx_ref']} arrived for a cancelled invoice - needs manual review.");
                return self::summary($db, $attempt, 'review');
            }

            $channel = (is_array($data['authorization'] ?? null)) ? ($data['authorization']['channel'] ?? null) : null;
            $method = $channel ? 'PayChangu - ' . $channel : 'PayChangu';

            $ins = $db->prepare('INSERT INTO payments (invoice_id, amount, method, reference, recorded_by) VALUES (:iid, :amount, :method, :ref, NULL)');
            $ins->execute([
                ':iid' => $invoice['id'],
                ':amount' => $attempt['amount'],
                ':method' => $method,
                ':ref' => $attempt['tx_ref'],
            ]);

            $paid = self::amountPaid($db, (int) $invoice['id']);
            $newStatus = ($paid + 0.01 >= (float) $invoice['total']) ? 'Paid' : 'Partially Paid';
            $db->prepare('UPDATE invoices SET status = :s WHERE id = :id')->execute([':s' => $newStatus, ':id' => $invoice['id']]);

            $done = $db->prepare("UPDATE payment_attempts SET status = 'success', gateway_response = :r, completed_at = now() WHERE id = :id");
            $done->execute([':r' => json_encode($body), ':id' => $attempt['id']]);

            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('Recording PayChangu payment failed: ' . $e->getMessage());
            return self::summary($db, $attempt, 'error');
        }

        self::afterPayment($db, $invoice, (float) $attempt['amount'], $attempt['tx_ref']);
        return self::summary($db, $attempt, 'success');
    }

    /** Notifications and audit trail. Failures here must never undo a recorded payment. */
    private static function afterPayment(PDO $db, array $invoice, float $amount, string $txRef): void
    {
        $money = 'MK ' . number_format($amount);

        try {
            $db->prepare(
                "INSERT INTO audit_logs (user_id, role, action, affected_table, affected_id, new_value)
                 VALUES (NULL, NULL, 'Online payment received', 'invoices', :id, :v)"
            )->execute([':id' => $invoice['id'], ':v' => json_encode(['amount' => $amount, 'tx_ref' => $txRef])]);
        } catch (Throwable $e) {
            error_log('Audit failed: ' . $e->getMessage());
        }

        try {
            $notify = $db->prepare('INSERT INTO notifications (user_id, message) VALUES (:u, :m)');

            $notify->execute([
                ':u' => $invoice['customer_id'],
                ':m' => "Payment of $money received for invoice {$invoice['invoice_number']}. Thank you!",
            ]);

            $staffMsg = $invoice['order_id']
                ? "Order #{$invoice['order_id']} has been paid ($money) and is waiting for your approval."
                : "Invoice {$invoice['invoice_number']} has been paid ($money).";

            $staff = $db->query("SELECT id FROM users WHERE role IN ('manager', 'admin') AND is_active IS NOT FALSE");
            foreach ($staff->fetchAll() as $s) {
                $notify->execute([':u' => $s['id'], ':m' => $staffMsg]);
            }
        } catch (Throwable $e) {
            error_log('Payment notifications failed: ' . $e->getMessage());
        }
    }

    private static function markAttempt(PDO $db, int $attemptId, string $status, array $response): void
    {
        $upd = $db->prepare('UPDATE payment_attempts SET status = :s, gateway_response = :r, completed_at = now() WHERE id = :id');
        $upd->execute([':s' => $status, ':r' => json_encode($response), ':id' => $attemptId]);
    }

    private static function summary(PDO $db, array $attempt, string $state): array
    {
        $q = $db->prepare('SELECT id, invoice_number, status, order_id FROM invoices WHERE id = :id');
        $q->execute([':id' => $attempt['invoice_id']]);
        $inv = $q->fetch() ?: [];

        return [
            'state' => $state,
            'tx_ref' => $attempt['tx_ref'],
            'amount' => (float) $attempt['amount'],
            'invoice_id' => $inv['id'] ?? null,
            'invoice_number' => $inv['invoice_number'] ?? null,
            'invoice_status' => $inv['status'] ?? null,
            'order_id' => $inv['order_id'] ?? null,
        ];
    }
}