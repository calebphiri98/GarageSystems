<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Audit.php';
require_once __DIR__ . '/../middleware/auth.php';

class ServiceController
{
    /** Public: anyone (including guests) can browse the service catalog. */
    public static function list(): void
    {
        $db = Database::connect();
        $stmt = $db->query('SELECT * FROM services WHERE is_active = TRUE ORDER BY name');
        Response::success($stmt->fetchAll());
    }

    /** Admin/manager: add a new service to the catalog. */
    public static function create(array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $name = trim($body['name'] ?? '');
        $description = trim($body['description'] ?? '');
        $price = $body['estimated_price'] ?? null;

        if (!$name) {
            Response::error('Service name is required.');
        }

        $stmt = $db = Database::connect();
        $ins = $db->prepare(
            'INSERT INTO services (name, description, estimated_price) VALUES (:name, :desc, :price) RETURNING id'
        );
        $ins->execute([':name' => $name, ':desc' => $description ?: null, ':price' => $price]);
        $id = $ins->fetch()['id'];

        Audit::log($payload['id'], $payload['role'], 'Added service to catalog', 'services', $id);
        Response::success(['id' => $id], 'Service added.', 201);
    }

    /** Admin/manager: edit or deactivate a service. */
    public static function update(int $id, array $body): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $db = Database::connect();
        $existing = $db->prepare('SELECT * FROM services WHERE id = :id');
        $existing->execute([':id' => $id]);
        $service = $existing->fetch();
        if (!$service) {
            Response::error('Service not found.', 404);
        }

        $name = trim($body['name'] ?? $service['name']);
        $description = $body['description'] ?? $service['description'];
        $price = $body['estimated_price'] ?? $service['estimated_price'];
        $isActive = array_key_exists('is_active', $body) ? (bool) $body['is_active'] : $service['is_active'];

        $upd = $db->prepare(
            'UPDATE services SET name = :name, description = :desc, estimated_price = :price, is_active = :active WHERE id = :id'
        );
        $upd->execute([':name' => $name, ':desc' => $description, ':price' => $price, ':active' => $isActive, ':id' => $id]);

        Audit::log($payload['id'], $payload['role'], 'Updated service', 'services', $id);
        Response::success([], 'Service updated.');
    }
}
