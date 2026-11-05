<?php
/**
 * Minimal .env loader - no Composer dependency required.
 * Reads backend/.env and exposes values via env('KEY', 'default').
 */

function load_env(string $path): void
{
    if (!file_exists($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (!str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        $value = trim($value, "\"'");
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

load_env(__DIR__ . '/../.env');

function env(string $key, $default = null)
{
    $value = $_ENV[$key] ?? getenv($key);
    return $value === false ? $default : $value;
}
