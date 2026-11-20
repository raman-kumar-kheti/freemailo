#!/bin/bash
# Generate self-signed TLS certificates for development
# In production, use Let's Encrypt via certbot

set -euo pipefail

CERT_DIR="${1:-./certs}"
HOSTNAME="${2:-mail.example.test}"

mkdir -p "$CERT_DIR"

echo "🔐 Generating self-signed certificates for $HOSTNAME..."

openssl req -x509 -nodes -days 3650 \
  -newkey rsa:4096 \
  -keyout "$CERT_DIR/mail.key" \
  -out "$CERT_DIR/mail.crt" \
  -subj "/C=US/ST=State/L=City/O=MailHive/CN=$HOSTNAME" \
  -addext "subjectAltName=DNS:$HOSTNAME,DNS:*.$HOSTNAME,DNS:localhost"

# DH parameters for Postfix
echo "🔐 Generating DH parameters (this may take a moment)..."
openssl dhparam -out "$CERT_DIR/dhparams.pem" 2048

chmod 600 "$CERT_DIR/mail.key"
chmod 644 "$CERT_DIR/mail.crt" "$CERT_DIR/dhparams.pem"

echo "✅ Certificates generated in $CERT_DIR"
echo "   - mail.crt (certificate)"
echo "   - mail.key (private key)"
echo "   - dhparams.pem (DH parameters)"
