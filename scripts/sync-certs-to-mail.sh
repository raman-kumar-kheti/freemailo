#!/usr/bin/env bash
set -euo pipefail

HOSTNAME=$(grep -E "^MAIL_HOSTNAME=" /home/ubuntu/freemailo/.env | cut -d"=" -f2 | tr -d " '\r\n\"")
HOSTNAME="${HOSTNAME:-mail.ramankumarkheti.com}"
LIVE_DIR="/etc/letsencrypt/live/${HOSTNAME}"
TARGET_DIR="/home/ubuntu/freemailo/certs"

if [ -f "${LIVE_DIR}/fullchain.pem" ] && [ -f "${LIVE_DIR}/privkey.pem" ]; then
    echo "[Certbot Hook] Syncing renewed certificates for ${HOSTNAME} into FreeMailo..."
    cp -L "${LIVE_DIR}/fullchain.pem" "${TARGET_DIR}/mail.crt"
    cp -L "${LIVE_DIR}/privkey.pem" "${TARGET_DIR}/mail.key"
    chown ubuntu:ubuntu "${TARGET_DIR}/mail.crt" "${TARGET_DIR}/mail.key"
    chmod 644 "${TARGET_DIR}/mail.crt"
    chmod 600 "${TARGET_DIR}/mail.key"
    
    echo "[Certbot Hook] Restarting Dovecot and Postfix containers..."
    docker compose -f /home/ubuntu/freemailo/docker-compose.yml restart dovecot postfix
    echo "[Certbot Hook] Certificates successfully deployed to mail services!"
fi
