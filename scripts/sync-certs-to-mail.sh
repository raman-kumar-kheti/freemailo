#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# FreeMailo - Automated Certbot Deploy Hook
# Synchronizes Let's Encrypt certificates to Postfix and Dovecot
# Works anywhere: any username, any directory, any hostname from .env / Certbot
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${FREEMAILO_DIR:-"$(cd "${SCRIPT_DIR}/.." && pwd)"}"
ENV_FILE="${PROJECT_ROOT}/.env"

# 1. Determine Hostname: Priority -> RENEWED_LINEAGE (Certbot env) -> .env -> argument
if [ -n "${RENEWED_LINEAGE:-}" ]; then
    LIVE_DIR="${RENEWED_LINEAGE}"
    HOSTNAME="$(basename "${RENEWED_LINEAGE}")"
else
    HOSTNAME=""
    if [ -f "${ENV_FILE}" ]; then
        HOSTNAME=$(grep -E "^MAIL_HOSTNAME=" "${ENV_FILE}" | cut -d"=" -f2 | tr -d " '\r\n\"" || true)
    fi
    HOSTNAME="${1:-${HOSTNAME:-}}"
    if [ -z "${HOSTNAME}" ]; then
        echo "[Certbot Hook] Error: MAIL_HOSTNAME not found in ${ENV_FILE} and not passed as argument." >&2
        exit 1
    fi
    LIVE_DIR="/etc/letsencrypt/live/${HOSTNAME}"
fi

TARGET_DIR="${PROJECT_ROOT}/certs"
mkdir -p "${TARGET_DIR}"

if [ -f "${LIVE_DIR}/fullchain.pem" ] && [ -f "${LIVE_DIR}/privkey.pem" ]; then
    echo "[Certbot Hook] Syncing renewed certificates for ${HOSTNAME} into ${TARGET_DIR}..."
    cp -L "${LIVE_DIR}/fullchain.pem" "${TARGET_DIR}/mail.crt"
    cp -L "${LIVE_DIR}/privkey.pem" "${TARGET_DIR}/mail.key"
    
    # Preserve current directory owner or fallback to the owner of PROJECT_ROOT
    TARGET_OWNER="$(stat -c '%U:%G' "${PROJECT_ROOT}" 2>/dev/null || echo "")"
    if [ -n "${TARGET_OWNER}" ]; then
        chown "${TARGET_OWNER}" "${TARGET_DIR}/mail.crt" "${TARGET_DIR}/mail.key" 2>/dev/null || true
    fi
    chmod 644 "${TARGET_DIR}/mail.crt"
    chmod 600 "${TARGET_DIR}/mail.key"

    # Reload/restart containers if docker compose is present and running
    COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
    if [ -f "${COMPOSE_FILE}" ] && command -v docker &>/dev/null; then
        echo "[Certbot Hook] Reloading Dovecot and Postfix containers..."
        docker compose -f "${COMPOSE_FILE}" restart dovecot postfix 2>/dev/null || true
    fi

    echo "[Certbot Hook] Certificates successfully deployed to mail services!"
else
    echo "[Certbot Hook] Warning: No certificates found in ${LIVE_DIR}." >&2
fi
