<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class OrderController
{
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
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 422);
        }

        Audit::log($payload['id'], 'customer', 'Placed parts order', 'orders', $orderId);
        Response::success(['order_id' => $orderId], 'Order submitted and is pending review.', 201);
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
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 422);
        }

        Audit::log($payload['id'], $payload['role'], 'Cancelled order', 'orders', $id, null, null, $body['reason'] ?? null);
        Response::success([], 'Order cancelled.');
    }

    public static function list(): void
    {
        $payload = require_auth();
        $db = Database::connect();

        if ($payload['role'] === 'customer') {
            $stmt = $db->prepare('SELECT * FROM orders WHERE customer_id = :cid ORDER BY created_at DESC');
            $stmt->execute([':cid' => $payload['id']]);
        } else {
            $stmt = $db->query('SELECT o.*, u.name AS customer_name FROM orders o JOIN users u ON u.id = o.customer_id ORDER BY o.created_at DESC');
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
        $items = $db->prepare('SELECT oi.*, p.quantity AS stock, p.name FROM order_items oi JOIN parts p ON p.id = oi.part_id WHERE oi.order_id = :id');
        $items->execute([':id' => $id]);
        $rows = $items->fetchAll();
        if (!$rows) {
            Response::error('Order not found or has no items.', 404);
        }

        if ($decision === 'Confirmed') {
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
        } else {
            $upd = $db->prepare('UPDATE orders SET status = :status, reviewed_by = :by WHERE id = :id');
            $upd->execute([':status' => 'Rejected', ':by' => $payload['id'], ':id' => $id]);
        }

        Audit::log($payload['id'], $payload['role'], "Order $decision", 'orders', $id);
        Response::success([], "Order $decision.");
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