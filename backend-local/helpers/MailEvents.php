<?php
require_once __DIR__ . '/Mailer.php';

class MailEvents
{
    private static function when(?string $value): string
    {
        $ts = $value ? strtotime($value) : false;
        return $ts ? date('D, d M Y H:i', $ts) : 'Not set';
    }

    private static function firstName(?string $name): string
    {
        $parts = preg_split('/\s+/', trim((string) $name));
        return $parts[0] ?: 'there';
    }

    private static function run(callable $fn): void
    {
        try {
            $fn();
        } catch (Throwable $e) {
            error_log('MailEvents: ' . $e->getMessage());
        }
    }

    public static function newAppointment(PDO $db, int $appointmentId): void
    {
        self::run(function () use ($db, $appointmentId) {
            $q = $db->prepare(
                'SELECT a.service_type, a.requested_date, a.notes, u.name AS customer, u.phone,
                        v.make, v.model, v.plate_number
                 FROM appointments a
                 JOIN users u ON u.id = a.customer_id
                 JOIN vehicles v ON v.id = a.vehicle_id
                 WHERE a.id = :id'
            );
            $q->execute([':id' => $appointmentId]);
            $a = $q->fetch();
            if (!$a) {
                return;
            }

            $text = "A customer has requested a new appointment.\n\n"
                . "Customer: {$a['customer']}" . ($a['phone'] ? " ({$a['phone']})" : '') . "\n"
                . "Vehicle: {$a['make']} {$a['model']} ({$a['plate_number']})\n"
                . "Service: {$a['service_type']}\n"
                . 'Requested for: ' . self::when($a['requested_date']) . "\n"
                . ($a['notes'] ? "Notes: {$a['notes']}\n" : '')
                . "\nPlease review and confirm it.";

            Mailer::toAdmins(
                $db,
                'New appointment request from ' . $a['customer'],
                $text,
                ['label' => 'Review appointments', 'path' => '/admin/appointments']
            );
        });
    }

    public static function appointmentConfirmed(PDO $db, int $appointmentId): void
    {
        self::run(function () use ($db, $appointmentId) {
            $q = $db->prepare(
                'SELECT a.customer_id, a.service_type, a.requested_date, u.name AS customer,
                        v.make, v.model, v.plate_number
                 FROM appointments a
                 JOIN users u ON u.id = a.customer_id
                 JOIN vehicles v ON v.id = a.vehicle_id
                 WHERE a.id = :id'
            );
            $q->execute([':id' => $appointmentId]);
            $a = $q->fetch();
            if (!$a) {
                return;
            }

            $text = 'Hi ' . self::firstName($a['customer']) . ",\n\n"
                . "Good news - your appointment has been confirmed.\n\n"
                . 'When: ' . self::when($a['requested_date']) . "\n"
                . "Service: {$a['service_type']}\n"
                . "Vehicle: {$a['make']} {$a['model']} ({$a['plate_number']})\n\n"
                . 'Please bring your vehicle at the scheduled time. We look forward to seeing you.';

            Mailer::toUser(
                $db,
                (int) $a['customer_id'],
                'Your appointment is confirmed',
                $text,
                ['label' => 'View my appointments', 'path' => '/customer/appointments']
            );
        });
    }

    public static function jobReady(PDO $db, int $jobId): void
    {
        self::run(function () use ($db, $jobId) {
            $q = $db->prepare(
                'SELECT j.customer_id, j.job_number, u.name AS customer, v.make, v.model, v.plate_number
                 FROM job_cards j
                 JOIN users u ON u.id = j.customer_id
                 JOIN vehicles v ON v.id = j.vehicle_id
                 WHERE j.id = :id'
            );
            $q->execute([':id' => $jobId]);
            $j = $q->fetch();
            if (!$j) {
                return;
            }

            $text = 'Hi ' . self::firstName($j['customer']) . ",\n\n"
                . "The work on your {$j['make']} {$j['model']} ({$j['plate_number']}) is complete and it is ready for collection.\n\n"
                . "Job: {$j['job_number']}\n\n"
                . 'Please visit the garage to collect your vehicle and settle any outstanding invoice.';

            Mailer::toUser(
                $db,
                (int) $j['customer_id'],
                'Your vehicle is ready for collection',
                $text,
                ['label' => 'View my invoices', 'path' => '/customer/invoices']
            );
        });
    }

    private static function orderItemsText(PDO $db, int $orderId): string
    {
        $q = $db->prepare('SELECT p.name, oi.quantity FROM order_items oi JOIN parts p ON p.id = oi.part_id WHERE oi.order_id = :id ORDER BY p.name');
        $q->execute([':id' => $orderId]);
        $lines = [];
        foreach ($q->fetchAll() as $row) {
            $lines[] = '- ' . $row['name'] . ' x ' . $row['quantity'];
        }
        return implode("\n", $lines);
    }

    public static function orderConfirmed(PDO $db, int $orderId): void
    {
        self::run(function () use ($db, $orderId) {
            $q = $db->prepare('SELECT o.customer_id, u.name AS customer FROM orders o JOIN users u ON u.id = o.customer_id WHERE o.id = :id');
            $q->execute([':id' => $orderId]);
            $o = $q->fetch();
            if (!$o) {
                return;
            }

            $text = 'Hi ' . self::firstName($o['customer']) . ",\n\n"
                . "Your order #$orderId has been confirmed.\n\n"
                . self::orderItemsText($db, $orderId) . "\n\n"
                . 'We will let you know as soon as it is ready for collection.';

            Mailer::toUser(
                $db,
                (int) $o['customer_id'],
                "Your order #$orderId is confirmed",
                $text,
                ['label' => 'View my orders', 'path' => '/customer/orders']
            );
        });
    }

    public static function orderReady(PDO $db, int $orderId): void
    {
        self::run(function () use ($db, $orderId) {
            $q = $db->prepare('SELECT o.customer_id, u.name AS customer FROM orders o JOIN users u ON u.id = o.customer_id WHERE o.id = :id');
            $q->execute([':id' => $orderId]);
            $o = $q->fetch();
            if (!$o) {
                return;
            }

            $text = 'Hi ' . self::firstName($o['customer']) . ",\n\n"
                . "Your order #$orderId is ready for collection.\n\n"
                . self::orderItemsText($db, $orderId) . "\n\n"
                . 'Please visit the garage to pick it up.';

            Mailer::toUser(
                $db,
                (int) $o['customer_id'],
                "Your order #$orderId is ready for collection",
                $text,
                ['label' => 'View my orders', 'path' => '/customer/orders']
            );
        });
    }

    public static function lowStock(PDO $db, int $partId, int $quantityBefore): void
    {
        self::run(function () use ($db, $partId, $quantityBefore) {
            $q = $db->prepare('SELECT name, sku, quantity, min_stock_level FROM parts WHERE id = :id');
            $q->execute([':id' => $partId]);
            $p = $q->fetch();
            if (!$p) {
                return;
            }

            $now = (int) $p['quantity'];
            $min = (int) $p['min_stock_level'];
            if (!($quantityBefore > $min && $now <= $min)) {
                return;
            }

            $headline = $now === 0 ? 'is now out of stock' : 'is running low';
            $text = "{$p['name']} (SKU {$p['sku']}) $headline.\n\n"
                . "In stock: $now\n"
                . "Minimum level: $min\n\n"
                . 'Please restock it soon.';

            Mailer::toAdmins(
                $db,
                ($now === 0 ? 'Out of stock: ' : 'Low stock: ') . $p['name'],
                $text,
                ['label' => 'Open inventory', 'path' => '/admin/inventory']
            );
        });
    }
}