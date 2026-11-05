<?php
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/auth.php';

class CloudinaryController
{
    /** Admin/manager only: returns a short-lived signed payload the frontend uses to upload directly to Cloudinary. */
    public static function sign(): void
    {
        $payload = require_auth();
        require_role($payload, ['admin', 'manager']);

        $apiSecret = $_ENV['CLOUDINARY_API_SECRET'] ?? getenv('CLOUDINARY_API_SECRET');
        $apiKey = $_ENV['CLOUDINARY_API_KEY'] ?? getenv('CLOUDINARY_API_KEY');
        $cloudName = $_ENV['CLOUDINARY_CLOUD_NAME'] ?? getenv('CLOUDINARY_CLOUD_NAME');

        if (!$apiSecret || !$apiKey || !$cloudName) {
            Response::error('Cloudinary is not configured on the server.', 500);
        }

        $timestamp = time();
        // Only parameters actually sent to Cloudinary (besides file/api_key) go into the signature.
        $paramsToSign = "timestamp=$timestamp";
        $signature = sha1($paramsToSign . $apiSecret);

        Response::success([
            'timestamp' => $timestamp,
            'signature' => $signature,
            'api_key' => $apiKey,
            'cloud_name' => $cloudName,
        ]);
    }
}
