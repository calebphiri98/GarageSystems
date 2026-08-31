<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class InventoryController
{
    public static function list(): void
    {
        require_auth(); // any logged-in role may view parts (customers browse for ordering)
        $db = Database::connect();
        $stmt = $db->query('SELECT * FROM parts ORDER BY name');
        $parts = $stmt->fetchAll();
        foreach ($parts as &$p) {
            $p['low_stock'] = $p['quantity'] <= $p['min_stock_level'];
        }
        Response::success($parts);
    }

    public static function create(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $name = trim($body['name'] ?? '');
        $sku = trim($body['sku'] ?? '');
        $price = $body['unit_price'] ?? null;
        $qty = (int) ($body['quantity'] ?? 0);
        $minStock = (int) ($body['min_stock_level'] ?? 5);
        $desc = trim($body['description'] ?? '');

        if (!$name || !$sku || $price === null) {
            Response::error('Name, SKU and unit price are required.');
        }

        $db = Database::connect();
        try {
            $stmt = $db->prepare(
                'INSERT INTO parts (name, sku, description, unit_price, quantity, min_stock_level)
                 VALUES (:name, :sku, :desc, :price, :qty, :min) RETURNING id'
            );
            $stmt->execute([
                ':name' => $name, ':sku' => $sku, ':desc' => $desc ?: null,
                ':price' => $price, ':qty' => $qty, ':min' => $minStock,
            ]);
            $id = $stmt->fetch()['id'];
        } catch (PDOException $e) {
            Response::error('A part with that SKU already exists.', 409);
        }

        if ($qty > 0) {
            $mv = $db->prepare("INSERT INTO stock_movements (part_id, type, quantity, reason, created_by) VALUES (:pid, 'in', :qty, 'Initial stock', :uid)");
            $mv->execute([':pid' => $id, ':qty' => $qty, ':uid' => $payload['id']]);
        }

        Audit::log($payload['id'], $payload['role'], 'Added new part', 'parts', $id);
        Response::success(['id' => $id], 'Part added to inventory.', 201);
    }

    /** Stock received from a supplier. */
    public static function stockIn(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $qty = (int) ($body['quantity'] ?? 0);
        if ($qty <= 0) {
            Response::error('Quantity must be greater than zero.');
        }

        $db = Database::connect();
        $db->beginTransaction();
        $upd = $db->prepare('UPDATE parts SET quantity = quantity + :qty WHERE id = :id');
        $upd->execute([':qty' => $qty, ':id' => $id]);
        $mv = $db->prepare("INSERT INTO stock_movements (part_id, type, quantity, reason, created_by) VALUES (:pid, 'in', :qty, :reason, :uid)");
        $mv->execute([':pid' => $id, ':qty' => $qty, ':reason' => $body['reason'] ?? 'Stock received', ':uid' => $payload['id']]);
        $db->commit();

        Audit::log($payload['id'], $payload['role'], 'Stock received', 'parts', $id, null, ['quantity_added' => $qty]);
        Response::success([], 'Stock updated.');
    }

    /** Manual adjustment - requires a reason (business rule). */
    public static function adjust(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $qty = (int) ($body['quantity'] ?? 0); // can be negative
        $reason = trim($body['reason'] ?? '');
        if ($qty === 0 || !$reason) {
            Response::error('A non-zero quantity and a reason are required for a manual adjustment.');
        }

        $db = Database::connect();
        $part = $db->prepare('SELECT quantity FROM parts WHERE id = :id');
        $part->execute([':id' => $id]);
        $row = $part->fetch();
        if (!$row) {
            Response::error('Part not found.', 404);
        }
        if ($row['quantity'] + $qty < 0) {
            Response::error('Adjustment would result in negative stock.', 422);
        }

        $db->beginTransaction();
        $upd = $db->prepare('UPDATE parts SET quantity = quantity + :qty WHERE id = :id');
        $upd->execute([':qty' => $qty, ':id' => $id]);
        $mv = $db->prepare("INSERT INTO stock_movements (part_id, type, quantity, reason, created_by) VALUES (:pid, 'adjustment', :qty, :reason, :uid)");
        $mv->execute([':pid' => $id, ':qty' => $qty, ':reason' => $reason, ':uid' => $payload['id']]);
        $db->commit();

        Audit::log($payload['id'], $payload['role'], 'Manual stock adjustment', 'parts', $id, null, ['quantity_change' => $qty, 'reason' => $reason]);
        Response::success([], 'Stock adjusted.');
    }

    public static function lowStock(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $stmt = $db->query('SELECT * FROM parts WHERE quantity <= min_stock_level ORDER BY quantity ASC');
        Response::success($stmt->fetchAll());
    }
}
