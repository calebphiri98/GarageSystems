<?php
require_once __DIR__ . '/../config/env.php';

/**
 * Minimal HS256 JWT encode/decode. Avoids requiring Composer/firebase-jwt
 * so the project can be extracted and run with plain PHP.
 */
class Jwt
{
    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function encode(array $payload): string
    {
        $secret = env('JWT_SECRET', 'insecure_default_change_me');
        $header = self::base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload['exp'] = time() + (int) env('JWT_EXPIRY_HOURS', 12) * 3600;
        $payload['iat'] = time();
        $body = self::base64UrlEncode(json_encode($payload));
        $signature = self::base64UrlEncode(hash_hmac('sha256', "$header.$body", $secret, true));
        return "$header.$body.$signature";
    }

    /**
     * Returns decoded payload array, or null if invalid/expired.
     */
    public static function decode(?string $token): ?array
    {
        if (!$token || substr_count($token, '.') !== 2) {
            return null;
        }
        [$header, $body, $signature] = explode('.', $token);
        $secret = env('JWT_SECRET', 'insecure_default_change_me');
        $expected = self::base64UrlEncode(hash_hmac('sha256', "$header.$body", $secret, true));
        if (!hash_equals($expected, $signature)) {
            return null;
        }
        $payload = json_decode(self::base64UrlDecode($body), true);
        if (!$payload || ($payload['exp'] ?? 0) < time()) {
            return null;
        }
        return $payload;
    }
}
