#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-${ROOT_DIR}/backups}"
mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
TIMESTAMP="$(date -u +'%Y%m%d_%H%M%S')"
DB_CONTAINER="${DB_CONTAINER:-mailhive-postgres}"
MAIL_CONTAINER="${MAIL_CONTAINER:-mailhive-dovecot}"
RSPAMD_CONTAINER="${RSPAMD_CONTAINER:-mailhive-rspamd}"
# Take an application-consistent snapshot while all mail/API writers are stopped.
# Postgres remains online for pg_dump. Never restore onto the live stack in tests.
WRITERS=(mailhive-api mailhive-postfix "$MAIL_CONTAINER" "$RSPAMD_CONTAINER" mailhive-redis)
RUNNING=()
for container in "${WRITERS[@]}"; do
  if [ "$(docker inspect -f '{{.State.Running}}' "$container")" = true ]; then RUNNING+=("$container"); fi
done
resume() { if [ "${#RUNNING[@]}" -gt 0 ]; then docker start "${RUNNING[@]}" >/dev/null; fi; }
trap resume EXIT
if [ "${#RUNNING[@]}" -gt 0 ]; then docker stop -t 30 "${RUNNING[@]}" >/dev/null; fi
DB_FILE="mailhive_db_${TIMESTAMP}.sql.gz"
VMAIL_FILE="mailhive_vmail_${TIMESTAMP}.tar.gz"
DKIM_FILE="mailhive_rspamd_${TIMESTAMP}.tar.gz"
QUEUE_FILE="mailhive_postfix_${TIMESTAMP}.tar.gz"
REDIS_FILE="mailhive_redis_${TIMESTAMP}.tar.gz"
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' | gzip > "$BACKUP_DIR/$DB_FILE"
docker run --rm --volumes-from "$MAIL_CONTAINER":ro alpine:3.22 tar -czf - -C /var/vmail . > "$BACKUP_DIR/$VMAIL_FILE"
docker run --rm --volumes-from "$RSPAMD_CONTAINER":ro alpine:3.22 tar -czf - -C /var/lib/rspamd . > "$BACKUP_DIR/$DKIM_FILE"
docker run --rm --volumes-from mailhive-postfix:ro alpine:3.22 tar -czf - -C /var/spool/postfix . > "$BACKUP_DIR/$QUEUE_FILE"
docker run --rm --volumes-from mailhive-redis:ro alpine:3.22 tar -czf - -C /data . > "$BACKUP_DIR/$REDIS_FILE"
cd "$BACKUP_DIR"
sha256sum "$DB_FILE" "$VMAIL_FILE" "$DKIM_FILE" "$QUEUE_FILE" "$REDIS_FILE" > "mailhive_backup_${TIMESTAMP}.sha256"
printf '{"timestamp":"%s","format":3,"includes":["database","maildir","rspamd","postfix","redis"]}\n' "$TIMESTAMP" > "mailhive_backup_${TIMESTAMP}.json"
ln -sfn "mailhive_backup_${TIMESTAMP}.json" latest.json
printf 'Backup verified and saved: %s/%s\n' "$BACKUP_DIR" "$TIMESTAMP"
sha256sum -c "mailhive_backup_${TIMESTAMP}.sha256"
