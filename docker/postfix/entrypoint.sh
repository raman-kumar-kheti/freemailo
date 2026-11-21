#!/bin/bash
set -euo pipefail

echo "🚀 MailHive Postfix starting..."

# Substitute environment variables into config files
sed -i "s|MAIL_HOSTNAME_PLACEHOLDER|${MAIL_HOSTNAME}|g" /etc/postfix/main.cf
sed -i "s|MAIL_DOMAIN_PLACEHOLDER|${MAIL_DOMAIN}|g" /etc/postfix/main.cf

# Substitute PostgreSQL password into pgsql map files
for f in /etc/postfix/pgsql-virtual-*.cf; do
    sed -i "s|POSTGRES_PASSWORD_PLACEHOLDER|${POSTGRES_PASSWORD}|g" "$f"
    chmod 640 "$f"
    chown root:postfix "$f"
done

# Ensure proper permissions
chmod 644 /etc/postfix/main.cf
chmod 644 /etc/postfix/master.cf

# Certificates are operator-managed and mounted read-only. Fail clearly instead
# of attempting to generate an untrusted replacement inside the container.
for required in mail.crt mail.key dhparams.pem; do
    if [ ! -s "/etc/ssl/mail/$required" ]; then
        echo "Required TLS file missing: /etc/ssl/mail/$required" >&2
        exit 1
    fi
done

# Refresh the pinned certificate used by internal Sieve submission.
/usr/local/bin/update-relay-cert

# Ensure vmail directory exists
mkdir -p /var/vmail
chown -R 5000:5000 /var/vmail

# Create Postfix spool directories
mkdir -p /var/spool/postfix/pid
mkdir -p /var/spool/postfix/private

# Fix postfix permissions
postfix set-permissions 2>/dev/null || true

echo "✅ Postfix configured for ${MAIL_HOSTNAME}"
echo "   Virtual domains: PostgreSQL lookup"
echo "   Delivery: LMTP to Dovecot"
echo "   Milter: Rspamd on port 11332"

# Start Postfix in foreground
exec postfix start-fg
