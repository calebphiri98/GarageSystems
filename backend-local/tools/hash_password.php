<?php
/**
 * Usage: php backend/tools/hash_password.php "SomePassword123"
 * Prints a bcrypt hash suitable for the users.password_hash column,
 * e.g. for resetting the seeded manager/admin accounts directly in SQL.
 */
if ($argc < 2) {
    fwrite(STDERR, "Usage: php hash_password.php <plain-password>\n");
    exit(1);
}
echo password_hash($argv[1], PASSWORD_BCRYPT), PHP_EOL;
