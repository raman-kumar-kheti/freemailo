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

# Check TLS certs exist
if [ ! -f /etc/ssl/mail/mail.crt ] || [ ! -f /etc/ssl/mail/mail.key ]; then
    echo "⚠️  TLS certificates not found. Generating self-signed certs..."
    mkdir -p /etc/ssl/mail
    openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout /etc/ssl/mail/mail.key \
        -out /etc/ssl/mail/mail.crt \
        -subj "/CN=${MAIL_HOSTNAME}"
    # Generate DH params if missing
    if [ ! -f /etc/ssl/mail/dhparams.pem ]; then
        openssl dhparam -out /etc/ssl/mail/dhparams.pem 2048
    fi
fi

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
