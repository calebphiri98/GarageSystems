#!/bin/sh
set -e

# Render sets $PORT dynamically. Default to 8080 for local docker runs.
PORT="${PORT:-8080}"

sed -i "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf
sed -i "s/:80>/:${PORT}>/g" /etc/apache2/sites-available/000-default.conf

exec "$@"
