#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# FreeMailo Rspamd Entrypoint
# ---------------------------------------------------------------------------
# Generates hashed passwords, substitutes secrets into config files,
# prepares DKIM directories, and launches Rspamd in the foreground.
# ---------------------------------------------------------------------------

RSPAMD_PASSWORD="${RSPAMD_PASSWORD:-freemailo}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

CONFIG_DIR="/etc/rspamd/local.d"
DKIM_DIR="/var/lib/rspamd/dkim"
DKIM_SELECTORS_MAP="/etc/rspamd/dkim_selectors.map"

# --- 1. Generate hashed passwords for the web UI -------------------------
echo "[entrypoint] Generating Rspamd controller password hash..."
HASHED_PASSWORD=$(rspamadm pw --encrypt -p "${RSPAMD_PASSWORD}")

# Write the controller config with real hashed passwords
cat > "${CONFIG_DIR}/worker-controller.inc" <<EOF
bind_socket = "*:11334";
password = "${HASHED_PASSWORD}";
enable_password = "${HASHED_PASSWORD}";
EOF

echo "[entrypoint] Controller password configured."

# --- 2. Substitute Redis password into redis.conf -------------------------
if [ -n "${REDIS_PASSWORD}" ]; then
  sed -i "s|{{REDIS_PASSWORD}}|${REDIS_PASSWORD}|g" "${CONFIG_DIR}/redis.conf"
  echo "[entrypoint] Redis password substituted."
else
  # No password — remove the password line entirely so Rspamd connects
  # without authentication (typical for internal Docker networks).
  sed -i '/^password/d' "${CONFIG_DIR}/redis.conf"
  echo "[entrypoint] No REDIS_PASSWORD set; removed password directive from redis.conf."
fi

# --- 3. Prepare DKIM directories and selector map -------------------------
mkdir -p "${DKIM_DIR}"

if [ ! -f "${DKIM_SELECTORS_MAP}" ]; then
  touch "${DKIM_SELECTORS_MAP}"
  echo "[entrypoint] Created empty dkim_selectors.map."
fi

if [ ! -f "${DKIM_DIR}/example.test.freemailo.key" ]; then
  echo "[entrypoint] Generating default DKIM key for example.test (selector: freemailo)..."
  rspamadm dkim_keygen -d example.test -s freemailo -k "${DKIM_DIR}/example.test.freemailo.key" > "${DKIM_DIR}/example.test.freemailo.pub"
fi

# Ensure default selector mapping exists
if ! grep -q "example.test" "${DKIM_SELECTORS_MAP}"; then
  echo "example.test freemailo" >> "${DKIM_SELECTORS_MAP}"
  echo "[entrypoint] Added example.test -> freemailo to dkim_selectors.map."
fi

# Fallback: also provide dkim selector key link
if [ ! -f "${DKIM_DIR}/example.test.dkim.key" ]; then
  ln -sf "${DKIM_DIR}/example.test.freemailo.key" "${DKIM_DIR}/example.test.dkim.key"
fi

# --- 4. Fix ownership -----------------------------------------------------
chown -R _rspamd:_rspamd \
  /var/lib/rspamd \
  /var/log/rspamd \
  /run/rspamd \
  "${DKIM_SELECTORS_MAP}" || true

chown -R _rspamd:_rspamd "${CONFIG_DIR}" 2>/dev/null || true

chmod 750 "${DKIM_DIR}"
chmod 640 "${CONFIG_DIR}/worker-controller.inc"

echo "[entrypoint] Permissions set."

# The API worker (UID/GID 5000) writes keys without Docker socket access.
getent group freemailo-keys >/dev/null || groupadd -g 5000 freemailo-keys
usermod -a -G freemailo-keys _rspamd
chgrp 5000 /var/lib/rspamd
chmod 750 /var/lib/rspamd
chgrp -R 5000 "${DKIM_DIR}"
chmod 2770 "${DKIM_DIR}"
find "${DKIM_DIR}" -type f -name '*.key' -exec chmod 640 {} \;
find "${DKIM_DIR}" -type f -name '*.pub' -exec chmod 644 {} \;

# --- 5. Launch Rspamd in the foreground -----------------------------------
echo "[entrypoint] Starting Rspamd..."
exec rspamd -f -u _rspamd -g _rspamd
