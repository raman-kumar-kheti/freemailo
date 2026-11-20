#!/bin/bash
set -euo pipefail

echo "🚀 MailHive Dovecot starting..."

# Substitute environment variables
sed -i "s|POSTGRES_PASSWORD_PLACEHOLDER|${POSTGRES_PASSWORD}|g" /etc/dovecot/dovecot-sql.conf.ext
sed -i "s|MAIL_HOSTNAME_PLACEHOLDER|${MAIL_HOSTNAME}|g" /etc/dovecot/conf.d/15-lda.conf
sed -i "s|MAIL_DOMAIN_PLACEHOLDER|${MAIL_DOMAIN}|g" /etc/dovecot/conf.d/15-lda.conf
sed -i "s|MAIL_DOMAIN_PLACEHOLDER|${MAIL_DOMAIN}|g" /etc/dovecot/conf.d/20-lmtp.conf

# Set proper file permissions
chmod 600 /etc/dovecot/dovecot-sql.conf.ext
chown root:root /etc/dovecot/dovecot-sql.conf.ext

# Ensure vmail directory exists with correct ownership
mkdir -p /var/vmail
chown -R 5000:5000 /var/vmail

# Ensure sieve directory exists
mkdir -p /etc/dovecot/sieve/global

# Compile global sieve scripts
for sieve_file in /etc/dovecot/sieve/global/*.sieve; do
    if [ -f "$sieve_file" ]; then
        sievec "$sieve_file" 2>/dev/null || echo "⚠️  Warning: Could not compile $sieve_file"
    fi
done

# Check TLS certs exist
if [ ! -f /etc/ssl/mail/mail.crt ] || [ ! -f /etc/ssl/mail/mail.key ]; then
    echo "⚠️  TLS certificates not found. Generating self-signed certs..."
    mkdir -p /etc/ssl/mail
    openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout /etc/ssl/mail/mail.key \
        -out /etc/ssl/mail/mail.crt \
        -subj "/CN=${MAIL_HOSTNAME}"
fi

echo "✅ Dovecot configured for ${MAIL_HOSTNAME}"
echo "   IMAP: port 993 (TLS)"
echo "   LMTP: port 24"
echo "   ManageSieve: port 4190"
echo "   Auth: port 12345 (for Postfix SASL)"
echo "   Maildir: /var/vmail/%d/%n/Maildir"

# Start Dovecot in foreground
exec dovecot -F
