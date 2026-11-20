#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# MailHive Automated Restore Pipeline
# Usage: ./scripts/restore.sh [TIMESTAMP|latest] [BACKUP_DIR]
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

TARGET="${1:-latest}"
BACKUP_DIR="${2:-${ROOT_DIR}/backups}"

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "Error: Backup directory ${BACKUP_DIR} does not exist!" >&2
  exit 1
fi

cd "${BACKUP_DIR}"

if [ "${TARGET}" = "latest" ]; then
  if [ -f "latest.json" ]; then
    META_FILE="$(readlink -f "latest.json" 2>/dev/null || readlink "latest.json")"
  else
    META_FILE="$(ls -t mailhive_backup_*.json 2>/dev/null | head -n 1 || true)"
  fi
else
  META_FILE="mailhive_backup_${TARGET}.json"
fi

if [ -z "${META_FILE:-}" ] || [ ! -f "${META_FILE}" ]; then
  echo "Error: Backup metadata file ${META_FILE:-} not found in ${BACKUP_DIR}!" >&2
  exit 1
fi

TIMESTAMP=$(basename "${META_FILE}" | sed -e 's/mailhive_backup_//' -e 's/\.json//')
DB_FILE="mailhive_db_${TIMESTAMP}.sql.gz"
VMAIL_FILE="mailhive_vmail_${TIMESTAMP}.tar.gz"
SHA_FILE="mailhive_backup_${TIMESTAMP}.sha256"

echo "=================================================="
echo " Starting MailHive Restore: ${TIMESTAMP}"
echo " Source Directory: ${BACKUP_DIR}"
echo "=================================================="

# 1. Verify Checksums
echo "[1/3] Verifying SHA256 checksums..."
if [ -f "${SHA_FILE}" ]; then
  sha256sum -c "${SHA_FILE}"
else
  echo "Warning: Checksum file ${SHA_FILE} not found, verifying files exist..."
  test -f "${DB_FILE}"
  test -f "${VMAIL_FILE}"
fi
echo "      Integrity check PASSED."

# 2. Restore PostgreSQL Database
echo "[2/3] Restoring PostgreSQL database..."
gunzip -c "${DB_FILE}" | docker exec -i mailhive-postgres psql -U mailhive -d mailhive -q
echo "      PostgreSQL restore complete."

# 3. Restore Maildir Storage (/var/vmail)
echo "[3/3] Restoring Maildir storage..."
docker run --rm \
  -v mail-service_vmail:/vmail \
  -v "${BACKUP_DIR}":/backup \
  alpine sh -c "rm -rf /vmail/* && tar -xzf /backup/${VMAIL_FILE} -C /vmail && chown -R 5000:5000 /vmail"
echo "      Maildir restore complete."

# Flush Dovecot auth / connection caches & resync indexes
docker exec mailhive-dovecot doveadm auth cache flush 2>/dev/null || true
docker exec mailhive-dovecot doveadm force-resync -A '*' 2>/dev/null || true

echo "=================================================="
echo " MailHive Restore Successfully Completed!"
echo " Restored from snapshot: ${TIMESTAMP}"
echo "=================================================="
