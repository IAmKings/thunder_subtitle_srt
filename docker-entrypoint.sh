#!/bin/sh
set -e

# Generate self-signed certificate if not exists
if [ ! -f /etc/nginx/certs/server.crt ]; then
    echo "Generating self-signed SSL certificate..."
    mkdir -p /etc/nginx/certs
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/nginx/certs/server.key \
        -out /etc/nginx/certs/server.crt \
        -subj "/CN=thunder-subtitle"
    echo "Self-signed certificate generated."
fi

exec /usr/bin/supervisord -c /etc/supervisord/supervisord.conf -n
