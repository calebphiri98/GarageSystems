<?php
require_once __DIR__ . '/../config/env.php';

class Mailer
{
    public static function send(string $toEmail, string $toName, string $subject, string $bodyText, ?array $action = null): bool
    {
        $html = self::render($subject, $bodyText, $action);
        $text = $bodyText;
        if ($action) {
            $text .= "\n\n" . ($action['label'] ?? 'Open') . ': ' . self::link($action['path'] ?? '/');
        }

        if (env('BREVO_API_KEY')) {
            return self::viaBrevo($toEmail, $toName, $subject, $text, $html);
        }

        if (env('SMTP_HOST') || env('GMAIL_USER')) {
            return self::viaSmtp($toEmail, $toName, $subject, $text, $html);
        }

        return false;
    }

    public static function toUser(PDO $db, int $userId, string $subject, string $text, ?array $action = null): void
    {
        $q = $db->prepare('SELECT name, email FROM users WHERE id = :id');
        $q->execute([':id' => $userId]);
        $user = $q->fetch();
        if ($user && !empty($user['email'])) {
            self::send($user['email'], $user['name'], $subject, $text, $action);
        }
    }

    public static function toAdmins(PDO $db, string $subject, string $text, ?array $action = null): void
    {
        $rows = $db->query(
            "SELECT name, email FROM users
             WHERE role = 'admin' AND is_active IS NOT FALSE AND email IS NOT NULL AND email <> ''"
        )->fetchAll();

        foreach ($rows as $admin) {
            self::send($admin['email'], $admin['name'], $subject, $text, $action);
        }
    }

    public static function link(string $path): string
    {
        $base = rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/');
        return $base . '/' . ltrim($path, '/');
    }

    private static function sender(): array
    {
        $email = env('BREVO_SENDER_EMAIL') ?: env('SMTP_FROM') ?: env('GMAIL_USER') ?: env('SMTP_USER');
        $name = env('BREVO_SENDER_NAME') ?: env('SMTP_FROM_NAME') ?: 'Uptown Garage';
        return [$email, $name];
    }

    private static function render(string $subject, string $body, ?array $action): string
    {
        $title = htmlspecialchars($subject, ENT_QUOTES, 'UTF-8');
        $content = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));

        $button = '';
        if ($action) {
            $href = htmlspecialchars(self::link($action['path'] ?? '/'), ENT_QUOTES, 'UTF-8');
            $label = htmlspecialchars($action['label'] ?? 'Open Uptown Garage', ENT_QUOTES, 'UTF-8');
            $button = '<p style="margin:28px 0 0;"><a href="' . $href . '" style="display:inline-block;background:#111827;color:#ffffff;'
                . 'text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">' . $label . '</a></p>';
        }

        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
            . '<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;"><tr><td align="center">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">'
            . '<tr><td style="background:#111827;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">Uptown Garage</td></tr>'
            . '<tr><td style="padding:28px;color:#374151;font-size:15px;line-height:1.6;">'
            . '<h2 style="margin:0 0 16px;font-size:18px;color:#111827;">' . $title . '</h2>'
            . '<div>' . $content . '</div>' . $button
            . '</td></tr>'
            . '<tr><td style="padding:16px 28px;background:#f9fafb;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;">'
            . 'This is an automated message from Uptown Garage. Please do not reply to this email.'
            . '</td></tr></table></td></tr></table></body></html>';
    }

    private static function viaBrevo(string $toEmail, string $toName, string $subject, string $text, string $html): bool
    {
        if (!function_exists('curl_init')) {
            error_log('Mailer: the PHP cURL extension is not enabled.');
            return false;
        }

        [$senderEmail, $senderName] = self::sender();
        if (!$senderEmail) {
            error_log('Mailer: no sender address configured (set BREVO_SENDER_EMAIL).');
            return false;
        }

        $payload = [
            'sender' => ['name' => $senderName, 'email' => $senderEmail],
            'to' => [['email' => $toEmail, 'name' => $toName !== '' ? $toName : $toEmail]],
            'subject' => $subject,
            'htmlContent' => $html,
            'textContent' => $text,
        ];

        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'accept: application/json',
                'content-type: application/json',
                'api-key: ' . trim((string) env('BREVO_API_KEY')),
            ],
        ];

        $ca = env('CURL_CA_BUNDLE');
        if ($ca && is_file($ca)) {
            $opts[CURLOPT_CAINFO] = $ca;
        }

        $ch = curl_init('https://api.brevo.com/v3/smtp/email');
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($raw === false) {
            error_log('Mailer: Brevo request failed - ' . $err);
            return false;
        }
        if ($code < 200 || $code >= 300) {
            error_log("Mailer: Brevo rejected the email ($code): " . $raw);
            return false;
        }
        return true;
    }

    private static function viaSmtp(string $toEmail, string $toName, string $subject, string $text, string $html): bool
    {
        $gmailUser = env('GMAIL_USER');
        $host = env('SMTP_HOST') ?: ($gmailUser ? 'smtp.gmail.com' : null);
        if (!$host) {
            return false;
        }

        $port = (int) env('SMTP_PORT', 587);
        $secure = strtolower((string) env('SMTP_SECURE', 'tls'));
        $user = env('SMTP_USER') ?: $gmailUser;
        $pass = env('SMTP_PASS') ?: str_replace(' ', '', (string) env('GMAIL_APP_PASSWORD', ''));
        [$fromEmail, $fromName] = self::sender();
        $fromEmail = $fromEmail ?: ($user ?: 'no-reply@example.com');

        try {
            $transport = $secure === 'ssl' ? 'ssl://' . $host : $host;
            $fp = @stream_socket_client("$transport:$port", $errno, $errstr, 10);
            if (!$fp) {
                error_log("Mailer: connection failed - $errstr ($errno)");
                return false;
            }
            stream_set_timeout($fp, 10);

            self::expect($fp, '220');
            self::command($fp, 'EHLO garage.local', '250');

            if ($secure === 'tls') {
                self::command($fp, 'STARTTLS', '220');
                if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new Exception('STARTTLS negotiation failed.');
                }
                self::command($fp, 'EHLO garage.local', '250');
            }

            if ($user && $pass) {
                self::command($fp, 'AUTH LOGIN', '334');
                self::command($fp, base64_encode($user), '334');
                self::command($fp, base64_encode($pass), '235');
            }

            self::command($fp, "MAIL FROM:<$fromEmail>", '250');
            self::command($fp, "RCPT TO:<$toEmail>", ['250', '251']);
            self::command($fp, 'DATA', '354');

            $boundary = 'b' . bin2hex(random_bytes(8));
            $headers = [
                'From: ' . self::encodeHeader($fromName) . " <$fromEmail>",
                'To: ' . self::encodeHeader($toName) . " <$toEmail>",
                'Subject: ' . self::encodeHeader($subject),
                'MIME-Version: 1.0',
                "Content-Type: multipart/alternative; boundary=\"$boundary\"",
                'Date: ' . date('r'),
            ];

            $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
                . chunk_split(base64_encode($text))
                . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
                . chunk_split(base64_encode($html))
                . "--$boundary--";

            $message = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.";
            self::command($fp, $message, '250');

            self::command($fp, 'QUIT', '221');
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
        foreach ($codes as $code) {
            if (strpos($response, $code) === 0) {
                return $response;
            }
        }
        throw new Exception("SMTP command failed: $response");
    }
}