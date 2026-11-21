#!/usr/bin/env bash
# Certbot deploy hook: install renewed certificates atomically, then reload mail.
set -euo pipefail
umask 077
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${CERT_DIR:-$ROOT_DIR/certs}"
LINEAGE="${RENEWED_LINEAGE:?Certbot must provide RENEWED_LINEAGE}"
openssl x509 -in "$LINEAGE/fullchain.pem" -noout -checkend 86400
mkdir -p "$CERT_DIR"
install -m 600 "$LINEAGE/privkey.pem" "$CERT_DIR/mail.key.new"
install -m 644 "$LINEAGE/fullchain.pem" "$CERT_DIR/mail.crt.new"
mv "$CERT_DIR/mail.key.new" "$CERT_DIR/mail.key"
mv "$CERT_DIR/mail.crt.new" "$CERT_DIR/mail.crt"
docker exec mailhive-postfix /usr/local/bin/update-relay-cert
docker exec mailhive-postfix postfix reload
docker exec mailhive-dovecot doveadm reload
