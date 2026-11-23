#!/bin/bash
# Generate self-signed TLS certificates for development
# In production, use Let's Encrypt via certbot

set -euo pipefail

CERT_DIR="${1:-./certs}"
MAIL_CERT_HOSTNAME="${2:-mail.example.test}"

# Re-running setup must never silently replace a working certificate/key.
if [ -e "$CERT_DIR/mail.crt" ] || [ -e "$CERT_DIR/mail.key" ]; then
    if [ -f "$CERT_DIR/mail.crt" ] && [ -f "$CERT_DIR/mail.key" ] && [ -f "$CERT_DIR/dhparams.pem" ]; then
        echo "Existing certificate, key and DH parameters preserved in $CERT_DIR"
        exit 0
    fi
    echo "Existing or incomplete TLS files in $CERT_DIR; inspect and preserve them before generating certificates." >&2
    exit 1
fi
umask 077
mkdir -p "$CERT_DIR"

echo "🔐 Generating self-signed certificates for $MAIL_CERT_HOSTNAME..."

openssl req -x509 -nodes -days 3650 \
  -newkey rsa:4096 \
  -keyout "$CERT_DIR/mail.key" \
  -out "$CERT_DIR/mail.crt" \
  -subj "/C=US/ST=State/L=City/O=FreeMailo/CN=$MAIL_CERT_HOSTNAME" \
  -addext "subjectAltName=DNS:$MAIL_CERT_HOSTNAME,DNS:*.$MAIL_CERT_HOSTNAME,DNS:localhost"

# DH parameters for Postfix
echo "🔐 Generating DH parameters (this may take a moment)..."
openssl dhparam -out "$CERT_DIR/dhparams.pem" 2048

chmod 600 "$CERT_DIR/mail.key"
chmod 644 "$CERT_DIR/mail.crt" "$CERT_DIR/dhparams.pem"

echo "✅ Certificates generated in $CERT_DIR"
echo "   - mail.crt (certificate)"
echo "   - mail.key (private key)"
echo "   - dhparams.pem (DH parameters)"
