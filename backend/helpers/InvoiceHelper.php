<?php

/**
 * Shared invoice logic for parts orders.
 */
class InvoiceHelper
{
    /** Next invoice id plus a unique, readable invoice number (no random collisions). */
    public static function nextNumber(PDO $db): array
    {
        $id = (int) $db->query("SELECT nextval(pg_get_serial_sequence('invoices', 'id'))")->fetchColumn();
        return [$id, 'INV-' . date('Ymd') . '-' . str_pad((string) $id, 4, '0', STR_PAD_LEFT)];
    }

    private static function orderTotal(PDO $db, int $orderId): float
    {
        $q = $db->prepare('SELECT COALESCE(SUM(quantity * unit_price), 0) FROM order_items WHERE order_id = :id');
        $q->execute([':id' => $orderId]);
        return (float) $q->fetchColumn();
    }

    /** Returns the invoice row for an order, creating it first if it does not exist. */
    public static function ensureForOrder(PDO $db, int $orderId): array
    {
        $find = $db->prepare('SELECT * FROM invoices WHERE order_id = :id');
        $find->execute([':id' => $orderId]);
        $existing = $find->fetch();
        if ($existing) {
            return $existing;
        }

        $o = $db->prepare('SELECT customer_id FROM orders WHERE id = :id');
        $o->execute([':id' => $orderId]);
        $order = $o->fetch();
        if (!$order) {
            throw new RuntimeException('Order not found.');
        }

        $total = self::orderTotal($db, $orderId);
        [$id, $number] = self::nextNumber($db);

        try {
            $ins = $db->prepare(
                "INSERT INTO invoices (id, invoice_number, source_type, order_id, customer_id, subtotal, discount, total, status)
                 VALUES (:id, :num, 'order', :oid, :cid, :t, 0, :t, 'Unpaid') RETURNING *"
            );
            $ins->execute([
                ':id' => $id,
                ':num' => $number,
                ':oid' => $orderId,
                ':cid' => $order['customer_id'],
                ':t' => $total,
            ]);
            return $ins->fetch();
        } catch (PDOException $e) {
            // Someone else created it at the same moment - use theirs.
            $find->execute([':id' => $orderId]);
            $row = $find->fetch();
            if ($row) {
                return $row;
            }
            throw $e;
        }
    }

    /** After an Unpaid order's items change, keep the invoice total in step. */
    public static function syncOrderTotal(PDO $db, int $orderId): void
    {
        $total = self::orderTotal($db, $orderId);
        $upd = $db->prepare(
            "UPDATE invoices SET subtotal = :t, total = GREATEST(0, :t - discount)
             WHERE order_id = :id AND status = 'Unpaid'"
        );
        $upd->execute([':t' => $total, ':id' => $orderId]);
    }
}