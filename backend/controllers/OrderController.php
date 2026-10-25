<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../helpers/InvoiceHelper.php';
require_once __DIR__ . '/../middleware/auth.php';

class OrderController
{
    /** Total already paid against the invoice of this order. */
    private static function amountPaid(PDO $db, int $orderId): float
    {
        $q = $db->prepare('SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.order_id = :id');
        $q->execute([':id' => $orderId]);
        return (float) $q->fetchColumn();
    }

    private static function notify(PDO $db, int $userId, string $message): void
    {
        try {
            $db->prepare('INSERT INTO notifications (user_id, message) VALUES (:u, :m)')->execute([':u' => $userId, ':m' => $message]);
        } catch (Throwable $e) {
            error_log('Notification failed: ' . $e->getMessage());
        }
    }

    public static function create(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['customer']);

        $items = $body['items'] ?? [];
        if (!is_array($items) || count($items) === 0) {
            Response::error('At least one item is required to place an order.');
        }

        $db = Database::connect();
        $db->beginTransaction();
        $invoice = null;
        try {
            $order = $db->prepare("INSERT INTO orders (customer_id, status) VALUES (:cid, 'Pending') RETURNING id");
            $order->execute([':cid' => $payload['id']]);
            $orderId = $order->fetch()['id'];

            foreach ($items as $item) {
                $partId = $item['part_id'] ?? null;
                $qty = (int) ($item['quantity'] ?? 0);
                if (!$partId || $qty <= 0) {
                    throw new Exception('Each item needs a valid part and quantity.');
                }
                $part = $db->prepare('SELECT unit_price, quantity, name FROM parts WHERE id = :id FOR UPDATE');
                $part->execute([':id' => $partId]);
                $partRow = $part->fetch();
                if (!$partRow) {
                    throw new Exception('One of the selected parts no longer exists.');
                }
                if ($qty > (int) $partRow['quantity']) {
                    throw new Exception("Only {$partRow['quantity']} of {$partRow['name']} available - you requested $qty.");
                }
                $ins = $db->prepare('INSERT INTO order_items (order_id, part_id, quantity, unit_price) VALUES (:oid, :pid, :qty, :price)');
                $ins->execute([':oid' => $orderId, ':pid' => $partId, ':qty' => $qty, ':price' => $partRow['unit_price']]);
            }

            // The invoice is created together with the order.
            $invoice = InvoiceHelper::ensureForOrder($db, (int) $orderId);

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 422);
        }

        Audit::log($payload['id'], 'customer', 'Placed parts order', 'orders', $orderId);
        Response::success([
            'order_id' => $orderId,
            'invoice_id' => $invoice['id'],
            'invoice_number' => $invoice['invoice_number'],
            'total' => (float) $invoice['total'],
        ], 'Order placed. Pay now so it can be approved.', 201);
    }

    public static function update(int $id, array $body): void
    {
        $payload = require_auth();

        $db = Database::connect();
        $order = $db->prepare('SELECT * FROM orders WHERE id = :id');
        $order->execute([':id' => $id]);
        $orderRow = $order->fetch();
        if (!$orderRow) {
            Response::error('Order not found.', 404);
        }

        $isOwner = $payload['role'] === 'customer' && (int) $orderRow['customer_id'] === (int) $payload['id'];
        $isStaff = in_array($payload['role'], ['admin', 'manager'], true);
        if (!$isOwner && !$isStaff) {
            Response::error('You do not have permission to edit this order.', 403);
        }
        if ($orderRow['status'] !== 'Pending') {
            Response::error('Only a Pending order can be edited.', 422);
        }
        if (self::amountPaid($db, $id) > 0) {
            Response::error('This order has already been paid for and can no longer be edited.', 422);
        }

        $items = $body['items'] ?? [];
        if (!is_array($items) || count($items) === 0) {
            Response::error('At least one item is required.');
        }

        $db->beginTransaction();
        try {
            foreach ($items as $item) {
                $partId = $item['part_id'] ?? null;
                $qty = (int) ($item['quantity'] ?? 0);
                if (!$partId || $qty <= 0) {
                    throw new Exception('Each item needs a valid part and a positive quantity.');
                }
                $part = $db->prepare('SELECT quantity, name FROM parts WHERE id = :id FOR UPDATE');
                $part->execute([':id' => $partId]);
                $partRow = $part->fetch();
                if (!$partRow) {
                    throw new Exception('One of the selected parts no longer exists.');
                }
                if ($qty > (int) $partRow['quantity']) {
                    throw new Exception("Only {$partRow['quantity']} of {$partRow['name']} available - you requested $qty.");
                }
            }

            $del = $db->prepare('DELETE FROM order_items WHERE order_id = :id');
            $del->execute([':id' => $id]);

            foreach ($items as $item) {
                $partId = $item['part_id'];
                $qty = (int) $item['quantity'];
                $price = $db->prepare('SELECT unit_price FROM parts WHERE id = :id');
                $price->execute([':id' => $partId]);
                $unitPrice = $price->fetch()['unit_price'];
                $ins = $db->prepare('INSERT INTO order_items (order_id, part_id, quantity, unit_price) VALUES (:oid, :pid, :qty, :price)');
                $ins->execute([':oid' => $id, ':pid' => $partId, ':qty' => $qty, ':price' => $unitPrice]);
            }

            // Keep the (unpaid) invoice total in step with the new items.
            InvoiceHelper::syncOrderTotal($db, $id);

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 422);
        }

        Audit::log($payload['id'], $payload['role'], 'Edited order items', 'orders', $id);
        Response::success([], 'Order updated.');
    }

    public static function cancel(int $id, array $body): void
    {
        $payload = require_auth();

        $db = Database::connect();
        $order = $db->prepare('SELECT * FROM orders WHERE id = :id');
        $order->execute([':id' => $id]);
        $orderRow = $order->fetch();
        if (!$orderRow) {
            Response::error('Order not found.', 404);
        }

        $isOwner = $payload['role'] === 'customer' && (int) $orderRow['customer_id'] === (int) $payload['id'];
        $isStaff = in_array($payload['role'], ['admin', 'manager'], true);
        if (!$isOwner && !$isStaff) {
            Response::error('You do not have permission to cancel this order.', 403);
        }
        if ($isOwner && $orderRow['status'] !== 'Pending') {
            Response::error('You can only cancel an order while it is still Pending. Contact the garage to cancel a confirmed order.', 422);
        }
        if (in_array($orderRow['status'], ['Completed', 'Cancelled'], true)) {
            Response::error("An order that is already {$orderRow['status']} cannot be cancelled.", 422);
        }

        $paid = self::amountPaid($db, $id);
        if ($isOwner && $paid > 0) {
            Response::error('This order has already been paid. Please contact the garage to cancel it and arrange a refund.', 422);
        }

        $db->beginTransaction();
        try {
            if (in_array($orderRow['status'], ['Confirmed', 'Ready for Collection'], true)) {
                $items = $db->prepare('SELECT * FROM order_items WHERE order_id = :id');
                $items->execute([':id' => $id]);
                foreach ($items->fetchAll() as $row) {
                    $upd = $db->prepare('UPDATE parts SET quantity = quantity + :qty WHERE id = :id');
                    $upd->execute([':qty' => $row['quantity'], ':id' => $row['part_id']]);
                    $mv = $db->prepare("INSERT INTO stock_movements (part_id, type, quantity, reference_order_id, created_by, reason) VALUES (:pid, 'in', :qty, :oid, :uid, 'Order cancelled - stock restored')");
                    $mv->execute([':pid' => $row['part_id'], ':qty' => $row['quantity'], ':oid' => $id, ':uid' => $payload['id']]);
                }
            }

            $upd = $db->prepare("UPDATE orders SET status = 'Cancelled', reviewed_by = COALESCE(reviewed_by, :by) WHERE id = :id");
            $upd->execute([':by' => $payload['id'], ':id' => $id]);

            // An invoice with no payments is simply cancelled.
            if ($paid <= 0) {
                $inv = $db->prepare("UPDATE invoices SET status = 'Cancelled' WHERE order_id = :id AND status = 'Unpaid'");
                $inv->execute([':id' => $id]);
            }
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 422);
        }

        Audit::log($payload['id'], $payload['role'], 'Cancelled order', 'orders', $id, null, null, $body['reason'] ?? null);

        if ($isStaff) {
            self::notify($db, (int) $orderRow['customer_id'], "Your order #$id was cancelled by the garage.");
        }

        $msg = $paid > 0
            ? 'Order cancelled. The customer had paid MK ' . number_format($paid) . ' - remember to refund them.'
            : 'Order cancelled.';
        Response::success([], $msg);
    }

    public static function list(): void
    {
        $payload = require_auth();
        $db = Database::connect();

        $sql = "SELECT o.*, u.name AS customer_name,
                       inv.id AS invoice_id, inv.invoice_number, inv.status AS invoice_status,
                       COALESCE(inv.total, (SELECT SUM(quantity * unit_price) FROM order_items WHERE order_id = o.id), 0) AS total_amount,
                       COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = inv.id), 0) AS amount_paid
                FROM orders o
                JOIN users u ON u.id = o.customer_id
                LEFT JOIN invoices inv ON inv.order_id = o.id";

        if ($payload['role'] === 'customer') {
            $stmt = $db->prepare($sql . ' WHERE o.customer_id = :cid ORDER BY o.created_at DESC');
            $stmt->execute([':cid' => $payload['id']]);
        } else {
            $stmt = $db->query($sql . ' ORDER BY o.created_at DESC');
        }
        $orders = $stmt->fetchAll();

        foreach ($orders as &$o) {
            $items = $db->prepare('SELECT oi.*, p.name AS part_name, p.quantity AS stock_available FROM order_items oi JOIN parts p ON p.id = oi.part_id WHERE oi.order_id = :id');
            $items->execute([':id' => $o['id']]);
            $o['items'] = $items->fetchAll();
        }

        Response::success($orders);
    }

    public static function review(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $decision = $body['decision'] ?? '';
        if (!in_array($decision, ['Confirmed', 'Rejected'], true)) {
            Response::error('Decision must be Confirmed or Rejected.');
        }

        $db = Database::connect();

        $o = $db->prepare('SELECT * FROM orders WHERE id = :id');
        $o->execute([':id' => $id]);
        $orderRow = $o->fetch();
        if (!$orderRow) {
            Response::error('Order not found.', 404);
        }
        if ($orderRow['status'] !== 'Pending') {
            Response::error("Only a Pending order can be reviewed (this one is {$orderRow['status']}).", 422);
        }

        $items = $db->prepare('SELECT oi.*, p.quantity AS stock, p.name FROM order_items oi JOIN parts p ON p.id = oi.part_id WHERE oi.order_id = :id');
        $items->execute([':id' => $id]);
        $rows = $items->fetchAll();
        if (!$rows) {
            Response::error('Order has no items.', 404);
        }

        $paid = self::amountPaid($db, $id);

        if ($decision === 'Confirmed') {
            // Payment must be complete before the manager can approve.
            $inv = $db->prepare('SELECT status FROM invoices WHERE order_id = :id');
            $inv->execute([':id' => $id]);
            $invoiceStatus = $inv->fetchColumn();
            if ($invoiceStatus !== 'Paid') {
                Response::error('This order has not been paid yet. Payment must be completed before it can be confirmed.', 422);
            }

            $db->beginTransaction();
            try {
                foreach ($rows as $row) {
                    if ($row['stock'] < $row['quantity']) {
                        throw new Exception("Cannot confirm: only {$row['stock']} of {$row['name']} in stock (ordered {$row['quantity']}).");
                    }
                }
                foreach ($rows as $row) {
                    $upd = $db->prepare('UPDATE parts SET quantity = quantity - :qty WHERE id = :id');
                    $upd->execute([':qty' => $row['quantity'], ':id' => $row['part_id']]);
                    $mv = $db->prepare("INSERT INTO stock_movements (part_id, type, quantity, reference_order_id, created_by) VALUES (:pid, 'sold', :qty, :oid, :uid)");
                    $mv->execute([':pid' => $row['part_id'], ':qty' => $row['quantity'], ':oid' => $id, ':uid' => $payload['id']]);
                }
                $upd = $db->prepare('UPDATE orders SET status = :status, reviewed_by = :by WHERE id = :id');
                $upd->execute([':status' => 'Confirmed', ':by' => $payload['id'], ':id' => $id]);
                $db->commit();
            } catch (Exception $e) {
                $db->rollBack();
                Response::error($e->getMessage(), 422);
            }

            self::notify($db, (int) $orderRow['customer_id'], "Your order #$id has been confirmed. We will let you know when it is ready for collection.");
        } else {
            $upd = $db->prepare('UPDATE orders SET status = :status, reviewed_by = :by WHERE id = :id');
            $upd->execute([':status' => 'Rejected', ':by' => $payload['id'], ':id' => $id]);

            if ($paid <= 0) {
                $db->prepare("UPDATE invoices SET status = 'Cancelled' WHERE order_id = :id AND status = 'Unpaid'")->execute([':id' => $id]);
            }

            $msg = "Your order #$id was rejected.";
            if ($paid > 0) {
                $msg .= ' Please contact the garage about your refund.';
            }
            self::notify($db, (int) $orderRow['customer_id'], $msg);
        }

        Audit::log($payload['id'], $payload['role'], "Order $decision", 'orders', $id);

        $resp = "Order $decision.";
        if ($decision === 'Rejected' && $paid > 0) {
            $resp .= ' The customer had paid MK ' . number_format($paid) . ' - remember to refund them.';
        }
        Response::success([], $resp);
    }

    public static function markStatus(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $status = $body['status'] ?? '';
        if (!in_array($status, ['Ready for Collection', 'Completed'], true)) {
            Response::error('Invalid status.');
        }

        $db = Database::connect();
        $upd = $db->prepare('UPDATE orders SET status = :status WHERE id = :id');
        $upd->execute([':status' => $status, ':id' => $id]);

        Audit::log($payload['id'], $payload['role'], "Order status -> $status", 'orders', $id);
        Response::success([], "Order marked $status.");
    }
}