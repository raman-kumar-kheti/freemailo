#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-latest}"
BACKUP_DIR="${2:-${ROOT_DIR}/backups}"
cd "$BACKUP_DIR"
if [ "$TARGET" = latest ]; then
  TARGET="$(basename "$(readlink latest.json)" .json)"
  TARGET="${TARGET#mailhive_backup_}"
fi
[[ "$TARGET" =~ ^[0-9]{8}_[0-9]{6}$ ]] || { echo 'Invalid backup timestamp' >&2; exit 1; }
# Require valid checksums before performing any mutation.
sha256sum -c "mailhive_backup_${TARGET}.sha256"
for archive in "mailhive_vmail_${TARGET}.tar.gz" "mailhive_rspamd_${TARGET}.tar.gz" "mailhive_postfix_${TARGET}.tar.gz" "mailhive_redis_${TARGET}.tar.gz"; do tar -tzf "$archive" >/dev/null; done
gzip -t "mailhive_db_${TARGET}.sql.gz"
if [ "${RESTORE_CONFIRM:-}" != replace-stopped-stack ]; then
  echo 'Verified backup. To replace a stopped stack, set RESTORE_CONFIRM=replace-stopped-stack.' >&2
  exit 2
fi
DB_CONTAINER="${DB_CONTAINER:-mailhive-postgres}"
MAIL_CONTAINER="${MAIL_CONTAINER:-mailhive-dovecot}"
RSPAMD_CONTAINER="${RSPAMD_CONTAINER:-mailhive-rspamd}"
for container in mailhive-api mailhive-postfix mailhive-redis "$MAIL_CONTAINER" "$RSPAMD_CONTAINER"; do
  [ "$(docker inspect -f '{{.State.Running}}' "$container")" = false ] || { echo "$container must be stopped before restore" >&2; exit 1; }
done
gunzip -c "mailhive_db_${TARGET}.sql.gz" | docker exec -i "$DB_CONTAINER" sh -c 'psql -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q'
# Volume contents are replaced only after integrity checks and explicit operator intent.
for spec in "$MAIL_CONTAINER:/var/vmail:mailhive_vmail" "$RSPAMD_CONTAINER:/var/lib/rspamd:mailhive_rspamd" "mailhive-postfix:/var/spool/postfix:mailhive_postfix" "mailhive-redis:/data:mailhive_redis"; do
  IFS=: read -r container directory prefix <<< "$spec"
  docker run --rm -i --volumes-from "$container" -e RESTORE_DIRECTORY="$directory" alpine:3.22 sh -c 'find "$RESTORE_DIRECTORY" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -xzf - -C "$RESTORE_DIRECTORY"' < "${prefix}_${TARGET}.tar.gz"
done
echo 'Restore complete. Reconcile provisioning jobs and rebuild mailbox indexes before restarting services. See deployment runbook.'
