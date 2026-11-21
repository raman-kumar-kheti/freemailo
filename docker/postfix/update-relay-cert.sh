#!/bin/sh
set -eu
# Rebuild the allowlist after certificate renewal; never trust arbitrary CAs.
fingerprint="$(openssl x509 -in /etc/ssl/mail/mail.crt -noout -fingerprint -sha256)"
fingerprint="${fingerprint#*=}"
printf '%s sieve\n' "$fingerprint" > /etc/postfix/relay_clientcerts
postmap /etc/postfix/relay_clientcerts
chmod 644 /etc/postfix/relay_clientcerts /etc/postfix/relay_clientcerts.db
