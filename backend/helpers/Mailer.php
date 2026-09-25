<?php
require_once __DIR__ . '/../config/env.php';

/**
 * A tiny dependency-free SMTP client, used to notify a mechanic by email
 * when they are assigned (or reassigned) to a job card.
 *
 * Configure via backend/.env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE (tls|ssl|none),
 *   SMTP_FROM, SMTP_FROM_NAME
 *
 * If SMTP_HOST is not set, send() silently no-ops (returns false) so the
 * rest of the app keeps working even without email configured - mailing
 * is a "nice to have" and must never block or crash a job assignment.
 */
class Mailer
{
    public static function send(string $toEmail, string $toName, string $subject, string $bodyText): bool
    {
        $host = env('SMTP_HOST');
        if (!$host) {
            return false; // Email not configured - fail quietly.
        }

        $port = (int) env('SMTP_PORT', 587);
        $secure = strtolower((string) env('SMTP_SECURE', 'tls')); // tls | ssl | none
        $user = env('SMTP_USER');
        $pass = env('SMTP_PASS');
        $fromEmail = env('SMTP_FROM', $user ?: 'no-reply@example.com');
        $fromName = env('SMTP_FROM_NAME', 'Uptown Garage');

        try {
            $transport = $secure === 'ssl' ? 'ssl://' . $host : $host;
            $fp = @stream_socket_client("$transport:$port", $errno, $errstr, 10);
            if (!$fp) {
                error_log("Mailer: connection failed - $errstr ($errno)");
                return false;
            }
            stream_set_timeout($fp, 10);

            self::expect($fp, '220');
            self::command($fp, "EHLO garage.local", '250');

            if ($secure === 'tls') {
                self::command($fp, "STARTTLS", '220');
                if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new Exception('STARTTLS negotiation failed.');
                }
                self::command($fp, "EHLO garage.local", '250');
            }

            if ($user && $pass) {
                self::command($fp, "AUTH LOGIN", '334');
                self::command($fp, base64_encode($user), '334');
                self::command($fp, base64_encode($pass), '235');
            }

            self::command($fp, "MAIL FROM:<$fromEmail>", '250');
            self::command($fp, "RCPT TO:<$toEmail>", ['250', '251']);
            self::command($fp, "DATA", '354');

            $headers = [
                'From: ' . self::encodeHeader($fromName) . " <$fromEmail>",
                'To: ' . self::encodeHeader($toName) . " <$toEmail>",
                'Subject: ' . self::encodeHeader($subject),
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=UTF-8',
                'Date: ' . date('r'),
            ];
            $message = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $bodyText) . "\r\n.";
            self::command($fp, $message, '250');

            self::command($fp, "QUIT", '221');
            fclose($fp);
            return true;
        } catch (Throwable $e) {
            error_log('Mailer: ' . $e->getMessage());
            return false;
        }
    }

    private static function encodeHeader(string $value): string
    {
        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }

    private static function expect($fp, string $code): string
    {
        $response = '';
        while ($line = fgets($fp, 515)) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        if (strpos($response, $code) !== 0) {
            throw new Exception("Unexpected SMTP response: $response");
        }
        return $response;
    }

    private static function command($fp, string $cmd, $expectedCodes): string
    {
        fwrite($fp, $cmd . "\r\n");
        $codes = is_array($expectedCodes) ? $expectedCodes : [$expectedCodes];
        $response = '';
        while ($line = fgets($fp, 515)) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        $ok = false;
        foreach ($codes as $code) {
            if (strpos($response, $code) === 0) {
                $ok = true;
                break;
            }
        }
        if (!$ok) {
            throw new Exception("SMTP command failed ($cmd): $response");
        }
        return $response;
    }
}
