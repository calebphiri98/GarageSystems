<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../helpers/MailEvents.php';
require_once __DIR__ . '/../middleware/auth.php';

class InventoryController
{
    /** Columns returned for every part (alias p = parts). */
    private const PART_COLUMNS = "p.id, p.name, p.sku, p.serial_number, p.brand, p.description, p.unit_price,
        p.quantity, p.min_stock_level, p.image_url, p.category, p.created_at,
        COALESCE((SELECT json_agg(pfo.option_id) FROM part_filter_options pfo WHERE pfo.part_id = p.id), '[]'::json) AS option_ids";

    /** "1,2,3" or [1,2,3] -> [1,2,3] (positive unique ints only). */
    private static function parseIds($raw): array
    {
        if (is_array($raw)) {
            $raw = implode(',', $raw);
        }
        $ids = array_filter(
            array_map('intval', explode(',', (string) $raw)),
            fn($v) => $v > 0
        );
        return array_values(array_unique($ids));
    }

    private static function decodeParts(array $parts): array
    {
        foreach ($parts as &$p) {
            $p['low_stock'] = $p['quantity'] <= $p['min_stock_level'];
            $p['option_ids'] = json_decode($p['option_ids'] ?? '[]', true) ?: [];
        }
        return $parts;
    }

    private static function syncOptions(PDO $db, int $partId, array $optionIds): void
    {
        $db->prepare('DELETE FROM part_filter_options WHERE part_id = :p')->execute([':p' => $partId]);

        if (!$optionIds) {
            return;
        }

        $ins = $db->prepare(
            'INSERT INTO part_filter_options (part_id, option_id) VALUES (:p, :o) ON CONFLICT DO NOTHING'
        );
        foreach ($optionIds as $optId) {
            $ins->execute([':p' => $partId, ':o' => $optId]);
        }
    }

    /**
     * GET /inventory
     * Query params:
     *   search     - words matched against name, SKU, serial number, brand, description
     *                (every word must match at least one of those fields)
     *   category   - exact category
     *   filters    - comma separated filter option ids, e.g. "3,7,12"
     *                (options of the same filter type are OR'd, different types are AND'd)
     *   min_price, max_price, in_stock, low_stock
     */
    public static function list(): void
    {
        $db = Database::connect();

        $search = trim($_GET['search'] ?? '');
        $category = trim($_GET['category'] ?? '');
        $minPrice = $_GET['min_price'] ?? '';
        $maxPrice = $_GET['max_price'] ?? '';
        $inStock = isset($_GET['in_stock']) && $_GET['in_stock'] !== '0' && $_GET['in_stock'] !== '';
        $lowStockOnly = isset($_GET['low_stock']) && $_GET['low_stock'] !== '0' && $_GET['low_stock'] !== '';
        $optionIds = self::parseIds($_GET['filters'] ?? '');

        $sql = 'SELECT ' . self::PART_COLUMNS . ' FROM parts p WHERE 1=1';
        $params = [];

        if ($search !== '') {
            $terms = preg_split('/\s+/', strtolower($search), -1, PREG_SPLIT_NO_EMPTY);
            foreach ($terms as $i => $term) {
                $key = ":s{$i}";
                $sql .= " AND (LOWER(p.name) LIKE {$key}
                          OR LOWER(p.sku) LIKE {$key}
                          OR LOWER(COALESCE(p.serial_number, '')) LIKE {$key}
                          OR LOWER(COALESCE(p.brand, '')) LIKE {$key}
                          OR LOWER(COALESCE(p.description, '')) LIKE {$key})";
                $params[$key] = '%' . $term . '%';
            }
        }

        if ($category !== '') {
            $sql .= ' AND LOWER(p.category) = LOWER(:category)';
            $params[':category'] = $category;
        }

        if (is_numeric($minPrice)) {
            $sql .= ' AND p.unit_price >= :min_price';
            $params[':min_price'] = $minPrice;
        }

        if (is_numeric($maxPrice)) {
            $sql .= ' AND p.unit_price <= :max_price';
            $params[':max_price'] = $maxPrice;
        }

        if ($inStock) {
            $sql .= ' AND p.quantity > 0';
        }

        if ($lowStockOnly) {
            $sql .= ' AND p.quantity <= p.min_stock_level';
        }

        // Selected filter options: OR inside one filter type, AND between types.
        if ($optionIds) {
            $in = implode(',', $optionIds); // ints only, safe to inline
            $rows = $db->query("SELECT id, filter_type_id FROM filter_options WHERE id IN ({$in})")->fetchAll();

            $byType = [];
            foreach ($rows as $r) {
                $byType[$r['filter_type_id']][] = (int) $r['id'];
            }

            foreach ($byType as $ids) {
                $sql .= ' AND EXISTS (SELECT 1 FROM part_filter_options x
                                      WHERE x.part_id = p.id AND x.option_id IN (' . implode(',', $ids) . '))';
            }
        }

        $sql .= ' ORDER BY p.name';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        Response::success(self::decodeParts($stmt->fetchAll()));
    }

    /**
     * GET /inventory/filters?category=Tyres
     * Returns the filter types for a category, each with its options and
     * how many parts carry that option.
     */
    public static function filters(): void
    {
        $category = trim($_GET['category'] ?? '');
        if ($category === '') {
            Response::success([]);
        }

        $db = Database::connect();

        $t = $db->prepare(
            'SELECT id, name FROM filter_types
             WHERE LOWER(category) = LOWER(:c)
             ORDER BY sort_order, name'
        );
        $t->execute([':c' => $category]);
        $types = $t->fetchAll();

        $o = $db->prepare(
            'SELECT fo.id, fo.filter_type_id, fo.value, COUNT(pfo.part_id) AS part_count
             FROM filter_options fo
             JOIN filter_types ft ON ft.id = fo.filter_type_id
             LEFT JOIN part_filter_options pfo ON pfo.option_id = fo.id
             WHERE LOWER(ft.category) = LOWER(:c)
             GROUP BY fo.id
             ORDER BY fo.value'
        );
        $o->execute([':c' => $category]);

        $optionsByType = [];
        foreach ($o->fetchAll() as $opt) {
            $optionsByType[$opt['filter_type_id']][] = [
                'id' => (int) $opt['id'],
                'value' => $opt['value'],
                'part_count' => (int) $opt['part_count'],
            ];
        }

        foreach ($types as &$type) {
            $type['options'] = $optionsByType[$type['id']] ?? [];
        }

        Response::success($types);
    }

    /** POST /inventory/filter-types  { category, name } */
    public static function createFilterType(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $category = trim($body['category'] ?? '');
        $name = trim($body['name'] ?? '');

        if (!$category || !$name) {
            Response::error('Category and filter name are required.');
        }

        $db = Database::connect();

        try {
            $stmt = $db->prepare('INSERT INTO filter_types (category, name) VALUES (:c, :n) RETURNING id');
            $stmt->execute([':c' => $category, ':n' => $name]);
            $id = $stmt->fetch()['id'];
        } catch (PDOException $e) {
            Response::error('That filter already exists for this category.', 409);
        }

        Audit::log($payload['id'], $payload['role'], 'Added filter type', 'filter_types', $id);
        Response::success(['id' => $id], 'Filter added.', 201);
    }

    /** POST /inventory/filter-options  { filter_type_id, value } */
    public static function createFilterOption(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $typeId = (int) ($body['filter_type_id'] ?? 0);
        $value = trim($body['value'] ?? '');

        if (!$typeId || !$value) {
            Response::error('Filter type and option value are required.');
        }

        $db = Database::connect();

        try {
            $stmt = $db->prepare('INSERT INTO filter_options (filter_type_id, value) VALUES (:t, :v) RETURNING id');
            $stmt->execute([':t' => $typeId, ':v' => $value]);
            $id = $stmt->fetch()['id'];
        } catch (PDOException $e) {
            Response::error('That option already exists (or the filter type is invalid).', 409);
        }

        Audit::log($payload['id'], $payload['role'], 'Added filter option', 'filter_options', $id);
        Response::success(['id' => $id], 'Option added.', 201);
    }

    /** DELETE /inventory/{id}/filter-type */
    public static function deleteFilterType(int $id): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $db->prepare('DELETE FROM filter_types WHERE id = :id')->execute([':id' => $id]);

        Audit::log($payload['id'], $payload['role'], 'Deleted filter type', 'filter_types', $id);
        Response::success([], 'Filter deleted.');
    }

    /** DELETE /inventory/{id}/filter-option */
    public static function deleteFilterOption(int $id): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $db->prepare('DELETE FROM filter_options WHERE id = :id')->execute([':id' => $id]);

        Audit::log($payload['id'], $payload['role'], 'Deleted filter option', 'filter_options', $id);
        Response::success([], 'Option deleted.');
    }

    public static function create(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $name = trim($body['name'] ?? '');
        $sku = trim($body['sku'] ?? '');
        $serial = trim($body['serial_number'] ?? '');
        $brand = trim($body['brand'] ?? '');
        $price = $body['unit_price'] ?? null;
        $qty = (int) ($body['quantity'] ?? 0);
        $minStock = (int) ($body['min_stock_level'] ?? 5);
        $desc = trim($body['description'] ?? '');
        $imageUrl = trim($body['image_url'] ?? '');
        $category = trim($body['category'] ?? '');
        $optionIds = self::parseIds($body['filter_option_ids'] ?? []);

        if (!$name || !$sku || $price === null) {
            Response::error('Name, SKU and unit price are required.');
        }

        $db = Database::connect();

        try {
            $stmt = $db->prepare(
                'INSERT INTO parts (name, sku, serial_number, brand, description, unit_price, quantity, min_stock_level, image_url, category)
                 VALUES (:name, :sku, :serial, :brand, :desc, :price, :qty, :min, :image, :category) RETURNING id'
            );

            $stmt->execute([
                ':name' => $name,
                ':sku' => $sku,
                ':serial' => $serial ?: null,
                ':brand' => $brand ?: null,
                ':desc' => $desc ?: null,
                ':price' => $price,
                ':qty' => $qty,
                ':min' => $minStock,
                ':image' => $imageUrl ?: null,
                ':category' => $category ?: null,
            ]);

            $id = $stmt->fetch()['id'];
        } catch (PDOException $e) {
            Response::error('A part with that SKU already exists.', 409);
        }

        self::syncOptions($db, (int) $id, $optionIds);

        if ($qty > 0) {
            $mv = $db->prepare("INSERT INTO stock_movements (part_id, type, quantity, reason, created_by) VALUES (:pid, 'in', :qty, 'Initial stock', :uid)");
            $mv->execute([
                ':pid' => $id,
                ':qty' => $qty,
                ':uid' => $payload['id']
            ]);
        }

        Audit::log($payload['id'], $payload['role'], 'Added new part', 'parts', $id);
        Response::success(['id' => $id], 'Part added to inventory.', 201);
    }

    /**
     * Edit a part's details. Quantity is intentionally not editable here -
     * stock changes must go through stockIn()/adjust() so every change is
     * recorded in stock_movements.
     *
     * serial_number, brand and filter_option_ids are only changed when the
     * request actually contains them, so older forms that don't send them
     * will not wipe the existing values.
     */
    public static function update(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $existing = $db->prepare('SELECT id, serial_number, brand FROM parts WHERE id = :id');
        $existing->execute([':id' => $id]);
        $current = $existing->fetch();
        if (!$current) {
            Response::error('Part not found.', 404);
        }

        $name = trim($body['name'] ?? '');
        $sku = trim($body['sku'] ?? '');
        $price = $body['unit_price'] ?? null;
        $minStock = $body['min_stock_level'] ?? null;
        $desc = trim($body['description'] ?? '');
        $imageUrl = trim($body['image_url'] ?? '');
        $category = trim($body['category'] ?? '');

        $serial = array_key_exists('serial_number', $body)
            ? (trim($body['serial_number'] ?? '') ?: null)
            : $current['serial_number'];
        $brand = array_key_exists('brand', $body)
            ? (trim($body['brand'] ?? '') ?: null)
            : $current['brand'];

        if (!$name || !$sku || $price === null) {
            Response::error('Name, SKU and unit price are required.');
        }

        try {
            $stmt = $db->prepare(
                'UPDATE parts SET name = :name, sku = :sku, serial_number = :serial, brand = :brand,
                 description = :desc, unit_price = :price, min_stock_level = :min,
                 image_url = :image, category = :category WHERE id = :id'
            );

            $stmt->execute([
                ':name' => $name,
                ':sku' => $sku,
                ':serial' => $serial,
                ':brand' => $brand,
                ':desc' => $desc ?: null,
                ':price' => $price,
                ':min' => ($minStock !== null && $minStock !== '') ? (int) $minStock : 5,
                ':image' => $imageUrl ?: null,
                ':category' => $category ?: null,
                ':id' => $id,
            ]);
        } catch (PDOException $e) {
            Response::error('A part with that SKU already exists.', 409);
        }

        if (array_key_exists('filter_option_ids', $body)) {
            self::syncOptions($db, $id, self::parseIds($body['filter_option_ids']));
        }

        Audit::log($payload['id'], $payload['role'], 'Edited part details', 'parts', $id);
        Response::success([], 'Part updated.');
    }

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
        $upd->execute([
            ':qty' => $qty,
            ':id' => $id
        ]);

        $mv = $db->prepare("INSERT INTO stock_movements (part_id, type, quantity, reason, created_by) VALUES (:pid, 'in', :qty, :reason, :uid)");
        $mv->execute([
            ':pid' => $id,
            ':qty' => $qty,
            ':reason' => $body['reason'] ?? 'Stock received',
            ':uid' => $payload['id']
        ]);

        $db->commit();

        Audit::log($payload['id'], $payload['role'], 'Stock received', 'parts', $id, null, [
            'quantity_added' => $qty
        ]);

        Response::success([], 'Stock updated.');
    }

    public static function adjust(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $qty = (int) ($body['quantity'] ?? 0);
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
        $upd->execute([
            ':qty' => $qty,
            ':id' => $id
        ]);

        $mv = $db->prepare("INSERT INTO stock_movements (part_id, type, quantity, reason, created_by) VALUES (:pid, 'adjustment', :qty, :reason, :uid)");
        $mv->execute([
            ':pid' => $id,
            ':qty' => $qty,
            ':reason' => $reason,
            ':uid' => $payload['id']
        ]);

        $db->commit();

        Audit::log($payload['id'], $payload['role'], 'Manual stock adjustment', 'parts', $id, null, [
            'quantity_change' => $qty,
            'reason' => $reason
        ]);

        if ($qty < 0) { MailEvents::lowStock($db, $id, (int) $row['quantity']); }
        Response::success([], 'Stock adjusted.');
    }

    public static function lowStock(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();

        $stmt = $db->query(
            'SELECT ' . self::PART_COLUMNS . '
             FROM parts p
             WHERE p.quantity <= p.min_stock_level
             ORDER BY p.quantity ASC'
        );

        Response::success(self::decodeParts($stmt->fetchAll()));
    }
}