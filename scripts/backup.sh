#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# MailHive Automated Backup Pipeline
# Usage: ./scripts/backup.sh [BACKUP_DIR]
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_DIR="${1:-${ROOT_DIR}/backups}"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
echo "=================================================="
echo " Starting MailHive Backup: ${TIMESTAMP}"
echo " Backup Destination: ${BACKUP_DIR}"
echo "=================================================="

DB_FILE="mailhive_db_${TIMESTAMP}.sql.gz"
VMAIL_FILE="mailhive_vmail_${TIMESTAMP}.tar.gz"
META_FILE="mailhive_backup_${TIMESTAMP}.json"
SHA_FILE="mailhive_backup_${TIMESTAMP}.sha256"

# 1. Backup PostgreSQL
echo "[1/3] Dumping PostgreSQL database..."
docker exec mailhive-postgres pg_dump -U mailhive -d mailhive --clean --if-exists | gzip > "${BACKUP_DIR}/${DB_FILE}"
DB_SIZE=$(stat -c%s "${BACKUP_DIR}/${DB_FILE}" 2>/dev/null || stat -f%z "${BACKUP_DIR}/${DB_FILE}")
echo "      PostgreSQL dump complete: ${DB_FILE} (${DB_SIZE} bytes)"

# 2. Backup Maildir (/var/vmail)
echo "[2/3] Archiving Maildir storage..."
docker run --rm \
  -v mail-service_vmail:/vmail:ro \
  -v "${BACKUP_DIR}":/backup \
  alpine tar -czf "/backup/${VMAIL_FILE}" -C /vmail .
VMAIL_SIZE=$(stat -c%s "${BACKUP_DIR}/${VMAIL_FILE}" 2>/dev/null || stat -f%z "${BACKUP_DIR}/${VMAIL_FILE}")
echo "      Maildir archive complete: ${VMAIL_FILE} (${VMAIL_SIZE} bytes)"

# 3. Generate Checksums and Metadata
echo "[3/3] Generating SHA256 checksums & metadata..."
cd "${BACKUP_DIR}"
sha256sum "${DB_FILE}" "${VMAIL_FILE}" > "${SHA_FILE}"

DB_SHA=$(sha256sum "${DB_FILE}" | awk '{print $1}')
VMAIL_SHA=$(sha256sum "${VMAIL_FILE}" | awk '{print $1}')

cat <<EOF > "${META_FILE}"
{
  "timestamp": "${TIMESTAMP}",
  "created_at": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "database": {
    "filename": "${DB_FILE}",
    "bytes": ${DB_SIZE},
    "sha256": "${DB_SHA}"
  },
  "vmail": {
    "filename": "${VMAIL_FILE}",
    "bytes": ${VMAIL_SIZE},
    "sha256": "${VMAIL_SHA}"
  }
}
EOF

# Update symlink for latest backup
ln -sf "${META_FILE}" "latest.json"

echo "=================================================="
echo " MailHive Backup Successfully Completed!"
echo " DB:       ${BACKUP_DIR}/${DB_FILE}"
echo " Vmail:    ${BACKUP_DIR}/${VMAIL_FILE}"
echo " Metadata: ${BACKUP_DIR}/${META_FILE}"
echo " Checksum: ${BACKUP_DIR}/${SHA_FILE}"
echo "=================================================="
