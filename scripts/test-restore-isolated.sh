#!/usr/bin/env bash
set -euo pipefail
# Restore a real snapshot into disposable resources. Never overwrite live data.
BACKUP_DIR="$(cd "${1:?Pass a backup directory}" && pwd)"
TIMESTAMP="$(basename "$(readlink "$BACKUP_DIR/latest.json")" .json)"
TIMESTAMP="${TIMESTAMP#mailhive_backup_}"
ID="mailhive-restore-check-$(date +%s)-$$"
cleanup() { docker rm -f "$ID" >/dev/null 2>&1 || true; docker volume rm "$ID" >/dev/null 2>&1 || true; }
trap cleanup EXIT
(cd "$BACKUP_DIR" && sha256sum -c "mailhive_backup_${TIMESTAMP}.sha256")
docker volume create "$ID" >/dev/null
docker run -d --name "$ID" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$ID" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
gunzip -c "$BACKUP_DIR/mailhive_db_${TIMESTAMP}.sql.gz" | docker exec -i "$ID" psql -v ON_ERROR_STOP=1 --single-transaction -U postgres -q
count="$(docker exec "$ID" psql -U postgres -tAc 'SELECT count(*) FROM mailboxes')"
[[ "$count" =~ ^[0-9]+$ ]] || { echo 'Database restore failed'; exit 1; }
# Verify archive extraction and compare byte-exact content with tar, not just existence.
for prefix in vmail rspamd postfix redis; do
  [ -f "$BACKUP_DIR/mailhive_${prefix}_${TIMESTAMP}.tar.gz" ] || continue
  docker run --rm -i -v "$ID:/restore" alpine:3.22 sh -c 'mkdir -p /restore/data; tar -xzf - -C /restore/data' < "$BACKUP_DIR/mailhive_${prefix}_${TIMESTAMP}.tar.gz"
  docker run --rm -i -v "$ID:/restore:ro" ubuntu:24.04 tar -dzf - -C /restore/data < "$BACKUP_DIR/mailhive_${prefix}_${TIMESTAMP}.tar.gz"
done
printf 'Isolated restore passed: %s mailbox records; available Maildir, DKIM, queue and Redis archives verified.\n' "$count"
