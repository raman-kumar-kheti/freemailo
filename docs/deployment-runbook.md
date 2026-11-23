# Deployment and recovery runbook

This is a single-host Compose deployment. The local acceptance results are recorded in [application-review.md](application-review.md). Public deliverability and production HTTPS must be verified on the actual host before release.

## Configuration and prerequisites

Use a Linux host with Docker Compose, a static public IP, outbound port 25, sufficient SSD capacity and working authoritative DNS. Start with 4 CPU cores and 4–8 GiB RAM; size disk and backups for the actual quotas. Provision a reverse proxy for webmail HTTPS. Do not publish the internal API, databases, Rspamd controller, LMTP or Dovecot auth ports. Docker port publishing can bypass host firewall rules: use provider firewall rules and Docker-aware filtering.

Copy `.env.example` to `.env`. Set `POSTGRES_DB=freemailo` and `POSTGRES_USER=freemailo` (the daemon SQL maps currently use these names). Generate distinct secrets with `openssl rand -hex 32`. Set `DATABASE_URL` to the `postgres` Compose hostname and URL-encode any non-hex password. Never use `.env.dev` on a public server.

Required production settings:

- `APP_URL=https://webmail.yourdomain.com` — exact browser origin; comma-separated origins are supported.
- `MAIL_HOSTNAME=mail.yourdomain.com`, `MAIL_DOMAIN=yourdomain.com`.
- `JWT_SECRET` (32+ characters), `JWT_ACCESS_EXPIRY=15m`, `JWT_REFRESH_EXPIRY=7d`.
- Unique `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `RSPAMD_PASSWORD`, `DOVECOT_MASTER_PASSWORD`; optional `DOVECOT_MASTER_USER` defaults to `freemailo_master`.
- `MAIL_TLS_REJECT_UNAUTHORIZED=true`, `MAIL_TLS_SERVERNAME=mail.yourdomain.com`, `COOKIE_SECURE=true`.

The API rejects insecure production cookie/TLS settings and missing secrets. For a private mail CA, mount a CA bundle into the API and set `NODE_EXTRA_CA_CERTS` in its Compose environment. The development override explicitly permits the local self-signed certificate and HTTP cookies.

## TLS and startup

Obtain certificates using Certbot with DNS validation or an HTTP challenge served by the reverse proxy. Install the full chain as `certs/mail.crt` (0644) and private key as `certs/mail.key` (0600). The mail containers mount this directory read-only. Configure Certbot's deploy hook to invoke the absolute path to `scripts/renew-mail-certs.sh`; it uses `RENEWED_LINEAGE`, replaces both files, updates the pinned relay certificate, and reloads Postfix/Dovecot. Verify renewal with `certbot renew --dry-run`. Generate `certs/dhparams.pem` once with `openssl dhparam -out certs/dhparams.pem 2048` (0644); Postfix startup requires all three files. Configure the web reverse proxy separately for HTTPS and SSE streaming (disable buffering and allow long-lived responses).

```bash
# Database first, then a dedicated migration container with the Prisma CLI.
docker compose up -d postgres redis
docker compose --profile tools run --rm --build migrate
docker compose up -d --build --wait

# Export these from a secure operator session; the password is not a CLI argument.
export ADMIN_EMAIL
export ADMIN_PASSWORD
docker compose exec -e ADMIN_EMAIL -e ADMIN_PASSWORD api node scripts/create-admin.cjs

curl --fail http://127.0.0.1:4000/api/health
```

`ADMIN_PASSWORD` must contain at least 16 characters. Existing administrators are never overwritten. Create domains and mailboxes through the admin UI and wait for their provisioning jobs to complete. The development seed is explicitly disabled in production. The API and web containers run as non-root users; the API has no Docker socket. The API worker writes Maildir and DKIM volumes using UID/GID 5000. Dovecot and Rspamd prepare volume permissions on startup.

Sieve-generated replies use internal port 2525 with implicit TLS and an explicitly pinned client certificate. Postfix denies this listener to clients without the matching private key; do not publish port 2525. Dovecot validates the server certificate using the shared full chain plus the OS trust store. The Compose mail hostname alias keeps this connection inside the mail network. See [Dovecot submission settings](https://doc.dovecot.org/2.3/configuration_manual/sieve/sieve_and_smtp_submission/) and [Postfix certificate authorization](https://www.postfix.org/TLS_README.html).

## Storage, jobs and monitoring

Persist all five volumes: PostgreSQL, Redis, Maildir, Rspamd/DKIM, and the Postfix queue. Redis uses `noeviction` because evicting BullMQ keys can lose jobs. Monitor memory and disk capacity; a full Redis must be expanded instead of switching back to LRU eviction.

Provisioning records are durable in PostgreSQL. The worker reconciles missing queue entries every 30 seconds, retries with exponential backoff, and marks exhausted jobs `DEAD_LETTER`. Fix the underlying error and use the admin job Retry button or `POST /api/admin/jobs/:id/retry`. Mailbox deletion disables authentication/delivery and archives data under `/var/vmail/.deleted/<mailbox-id>`; purge retained mail under an explicit retention policy.

`/api/health` checks PostgreSQL, Redis and mail TCP endpoints and returns 503 when degraded. `/api/metrics` exports process and account metrics. Restrict metrics and API documentation at the reverse proxy to your monitoring/administrative network. Use `docker compose logs` for structured API logs and daemon logs; ship them to your log collector. Container health checks do not replace external alerts or an end-to-end delivery probe.

API rate limits are currently per API process (20 logins/minute and general request limits). Behind a proxy, set `TRUST_PROXY` to only the known proxy IPs/CIDRs and configure that proxy to overwrite incoming forwarding headers; otherwise clients share the proxy's rate-limit bucket. Do not set a trust-all value. Multi-instance deployment needs shared throttling and coordination beyond this single-host layout. IMAP/SMTP brute-force protection must be configured on the host or at the network boundary. After restarting Dovecot, reload Postfix to close cached SASL connections before opening traffic.

## Backup and restore

Run `scripts/backup.sh /secure/backup/path` from the Docker host. It briefly stops API/mail/Redis writers, dumps PostgreSQL, archives Maildir, DKIM/Rspamd, Postfix spool and Redis persistence, writes SHA256 checksums, then restarts only services that were running. Plan this maintenance interruption. Keep encrypted copies off-host and restrict backup access: archives contain mail and credentials.

Verify every backup with `scripts/test-restore-isolated.sh /secure/backup/path`. It restores SQL into a disposable PostgreSQL container and compares extracted archive bytes. It never restores over live volumes.

For actual disaster recovery:

1. Preserve a copy of the current data and verify you selected the right snapshot.
2. Stop `api`, `postfix`, `dovecot`, `rspamd`, and `redis`; leave PostgreSQL running.
3. Run `RESTORE_CONFIRM=replace-stopped-stack scripts/restore.sh latest /secure/backup/path`. Missing/mismatched checksums and SQL errors stop restoration.
4. Start Redis and mail services, then the API/web. Run `doveadm force-resync` for affected mailboxes and check provisioning reconciliation, queues, authentication, sample attachments, and send/receive.
5. Keep the previous volumes until recovery acceptance is complete.

`test-backup-restore.py` is now a compatibility wrapper around the isolated verifier; it requires the backup directory as its argument.

## Release gates

Verify MX, exact SPF policy, published DKIM key and DMARC in authoritative DNS; PTR must match `MAIL_HOSTNAME`. Test delivery both ways with independent external providers and verify their authentication results. Configure MTA-STS/TLS-RPT if publishing those policies. Test trusted TLS on 465/587/993, expired/revoked sessions, relay denial, host-level brute-force protection, encrypted backup retention, monitoring alerts and disaster recovery. The repository's local tests cannot certify IP reputation, public DNS, provider restrictions or certificate renewal on your host.
