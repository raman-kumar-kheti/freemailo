# Troubleshooting

Start with the failed request's status and request ID, then the relevant daemon logs. Avoid printing secrets, tokens or full message bodies into shared diagnostics.

## Health and logs

```bash
curl --fail http://127.0.0.1:4000/api/health
docker logs --tail 100 freemailo-api
docker logs --tail 100 freemailo-dovecot
docker logs --tail 100 freemailo-postfix
docker logs --tail 100 freemailo-rspamd
docker exec freemailo-postfix postqueue -p
```

Health covers PostgreSQL, Redis, SMTP/IMAP connectivity and the Rspamd HTTP ping. A healthy listener does not establish successful authentication or external delivery. The admin system page shows the same health information. Do not delete the mail queue to resolve a transport failure; inspect the queue ID and underlying error first.

## “Couldn't load your mail” / IMAP FETCH disconnect

The confirmed incident involved imported Maildir filenames with `S=500` but only 369 bytes of content. Dovecot reported “Cached message size larger than expected”. A secondary LOGOUT exception hid the original FETCH failure.

The API now preserves the original error and the Dovecot configuration contains `maildir_broken_filename_sizes = yes`. Back up the affected mailbox before repair, verify the running configuration contains that setting, then resync only the affected folder:

```bash
docker exec freemailo-dovecot doveconf maildir_broken_filename_sizes
docker exec freemailo-dovecot doveadm force-resync -u user@yourdomain.com INBOX
```

Never generate test mail by inventing size suffixes in Maildir filenames; use SMTP or IMAP APPEND. A 401 means session expiry/account authorization, while a 503 normally indicates unavailable infrastructure. Inspect the request ID and server logs before attempting data repair.

## Authentication or submission failures

### `"Mailbox authentication is temporarily unavailable"` (API error `DEPTH_ZERO_SELF_SIGNED_CERT`)

If admin login succeeds and mailboxes provision cleanly, but logging into any user mailbox fails with `"Mailbox authentication is temporarily unavailable"` and `docker logs freemailo-api` shows `DEPTH_ZERO_SELF_SIGNED_CERT` (while `freemailo-dovecot` logs `TLS handshaking: Connection closed`):

* **Cause:** In production (`NODE_ENV=production`), the API sets `MAIL_TLS_REJECT_UNAUTHORIZED=true` and connects to Dovecot over IMAPS (`993`), validating the certificate against `MAIL_TLS_SERVERNAME` (`${MAIL_HOSTNAME}`). When `certs/mail.crt` and `certs/mail.key` still contain a self-signed certificate (for example after setting up Nginx + Let's Encrypt without syncing the certificate into `certs/`), Node.js rejects Dovecot's self-signed certificate.
* **Fix:**
  1. Ensure `MAIL_HOSTNAME` in `.env` matches the certificate's domain (`docker compose exec api env | grep MAIL_TLS`).
  2. Sync your Let's Encrypt certificate into `certs/` and restart `dovecot` and `postfix`:
     ```bash
     sudo ./scripts/sync-certs-to-mail.sh
     ```
     *(If using a commercial SSL cert, place your full chain at `certs/mail.crt` (`0644`) and key at `certs/mail.key` (`0600`), then run `docker compose restart dovecot postfix`.)*
  3. Link the deploy hook so future Certbot renewals stay synced automatically:
     ```bash
     sudo ln -sf "$(pwd)/scripts/sync-certs-to-mail.sh" /etc/letsencrypt/renewal-hooks/deploy/01-sync-freemailo-certs.sh
     ```
  *Note: You only need one server certificate for `MAIL_HOSTNAME`. Adding additional virtual email domains in `/admin/domains` does not require new certificates.*

### Credential and SASL checks

Use interactive `docker exec -it freemailo-dovecot doveadm auth test user@yourdomain.com` so the password is prompted rather than placed in shell history. Check that both mailbox and domain are active, credentials are current, and the certificate matches `MAIL_HOSTNAME`.

After restarting/replacing Dovecot, run `docker exec freemailo-postfix postfix reload` to close cached SASL connections. A temporary 454 after a daemon restart can be a stale auth connection. Do not automatically resend a message if the API reported SMTP acceptance but a failed Sent copy; that message may already be delivered.

For vacation replies, check Dovecot Sieve logs and the user's active script. Global spam routing is separate from IMAP-only training scripts. Replies use internal certificate-authorized TLS on 2525. After certificate changes run the renewal hook to refresh Postfix's allowed fingerprint. Do not publish that internal port or replace its certificate authorization with network-wide relay permission.

## Provisioning and DKIM

Inspect `/admin/jobs` for the actual failure and job state. The worker needs UID/GID 5000 write access to Maildir and the Rspamd DKIM directory; startup scripts establish the shared permissions. Fix the cause and use Retry for a failed/dead-letter job. Durable SQL jobs are reconciled with BullMQ every 30 seconds.

For domain lookups, the correct map is:

```bash
docker exec freemailo-postfix postmap -q yourdomain.com pgsql:/etc/postfix/pgsql-virtual-domains.cf
```

A disabled/deleted domain or mailbox is intentionally unavailable. Check DKIM selector `freemailo`, the key file permissions and the exact public key in DNS. Never paste private keys into tickets.

## Spam, quotas and rate limits

Moving a message into Junk trains spam; moving it out trains ham, except moving it to Trash. Training requires the Rspamd controller and the protected Dovecot curl credential file. The regression script verifies successful learning transactions; cached class totals may lag. GTUBE is a harmless filter test and should be rejected during SMTP DATA.

Admin usage reads Dovecot `maildirsize`. “Usage unavailable” indicates a missing, malformed or oversized quota counter, not zero usage. Verify Dovecot's quota configuration/counters; do not edit quota files while the mailbox is active.

General API limits are 30 requests/second and 200/minute per API process, with a separate 20/minute login limit. A reverse proxy must overwrite forwarding headers, and `TRUST_PROXY` must list only its real IP/CIDR. Otherwise users can share a rate-limit bucket. Investigate request loops before raising limits.

## Public delivery and recovery

### Outbound mail sends without UI error and appears in `Sent`, but recipients never receive it

* **Cause:** The API submits mail to Postfix over internal port `587`, which returns `250 Ok: queued` immediately—so the API appends a copy to `Sent` and the UI closes cleanly. Actual delivery happens asynchronously over **outbound destination TCP port `25`**. On cloud hosts (such as AWS EC2 by default), outbound port `25` is blocked at the network level even when Security Groups/firewalls allow all outbound traffic, causing IPv4 connections to time out (`dsn=4.4.1, status=deferred`) and unrouted IPv6 fallbacks to fail (`Network is unreachable`). Postfix holds deferred messages for `maximal_queue_lifetime = 3d` before sending a bounce back to the sender.
* **Diagnosis:**
  ```bash
  # 1. Inspect Postfix outbound queue and deferred errors
  docker exec freemailo-postfix postqueue -p
  docker logs --tail 100 freemailo-postfix | grep -E "status=deferred|timed out|bounced"

  # 2. Test outbound port 25 vs port 587 directly from the host
  nc -4 -vz -w 5 gmail-smtp-in.l.google.com 25
  nc -4 -vz -w 5 smtp.gmail.com 587
  ```
* **Fix:**
  1. Attach a static IP (Elastic IP on AWS), configure forward `A` and Reverse DNS (`PTR` = `MAIL_HOSTNAME`), and submit your cloud provider's port `25` unblock request (AWS: *Request to Remove Email Sending Limitations*).
  2. Once outbound port `25` succeeds, flush queued messages immediately:
     ```bash
     docker exec freemailo-postfix postqueue -f
     ```
  3. If inbound logs show `550 5.1.1 <postmaster@yourdomain.com>: Recipient address rejected: User unknown`, create a `postmaster@yourdomain.com` alias or mailbox in the Admin UI so DMARC reports and bounces are accepted.

### Nginx returns `404 Not Found` on `http://<server-ip>/` while `https://mail.yourdomain.com` works

This is expected after running `certbot --nginx --redirect`. Certbot adds a rule on port `80` that redirects `MAIL_HOSTNAME` to HTTPS (`301`) and returns `404` for any other `Host` header (including direct raw-IP requests). Always access Webmail and Admin through `https://<MAIL_HOSTNAME>`.

### DNS and production verification

Check MX, PTR, SPF, DKIM and DMARC on the actual public domain; inspect the recipient provider's Authentication-Results. Local `.test` delivery cannot validate public reputation or DNS. Follow the [deployment runbook](deployment-runbook.md) for production verification and [isolated restore procedure](deployment-runbook.md#backup-and-restore) for recovery. Test scripts must never restore over live volumes.
