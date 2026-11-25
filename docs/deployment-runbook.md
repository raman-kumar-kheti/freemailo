# Deployment and recovery runbook

This is a single-host Compose deployment. The local acceptance results are recorded in [application-review.md](application-review.md). Public deliverability and production HTTPS must be verified on the actual host before release.

## Configuration and prerequisites

Use a Linux host with Docker Compose, a static public IP, outbound port 25, sufficient SSD capacity and working authoritative DNS. Start with 4 CPU cores and 4–8 GiB RAM (or at least 1 GiB RAM + 4 GiB swap for low-traffic personal testing); size disk and backups for the actual quotas. Provision a reverse proxy for webmail HTTPS. Do not publish the internal API, databases, Rspamd controller, LMTP or Dovecot auth ports. Docker port publishing can bypass host firewall rules: use provider firewall rules and Docker-aware filtering.

### Cloud Outbound Port 25 Requirement (AWS EC2 & VPS Providers)

Inbound mail relies on port `25` (`-p 25:25`) being open in your firewall/security group. **Direct outbound email delivery** (sending from Postfix directly to Gmail, Outlook, Yahoo, etc. without a third-party SMTP relay) additionally requires **outbound destination TCP port `25`** to be open from your server to remote mail servers.

Cloud providers such as **AWS EC2** (and several VPS providers) block outbound port `25` at the hypervisor/network layer by default—even when your security group and OS firewall allow all outbound traffic (`0.0.0.0/0`). Inbound emails will arrive normally while outbound messages sit in Postfix's `deferred` queue until port `25` is unblocked.

To enable direct port `25` sending on AWS EC2 (or similar cloud hosts):

1. **Attach a static IP (Elastic IP on AWS):** Auto-assigned public IPs change across instance stops/resizes and do not support custom Reverse DNS.
2. **Set Forward DNS (`A` record):** Point `MAIL_HOSTNAME` (e.g. `mail.yourdomain.com`) to the static IP.
3. **Set Reverse DNS (`PTR` record):** Map the static IP back to `MAIL_HOSTNAME` (`mail.yourdomain.com`) in your cloud provider's IP settings (for AWS EC2: **Elastic IPs → Actions → Update reverse DNS**). Major providers (Gmail/Outlook) reject or spam-folder mail from generic cloud PTR hostnames.
4. **Request outbound port `25` removal:** Submit your provider's port `25` unblock form (on AWS: **Request to Remove Email Sending Limitations** / `ec2-email-limit-rdns-request`), specifying your region, Elastic IP, Reverse DNS, and anti-spam controls (SASL auth required, no open relay, SPF/DKIM/DMARC configured).
5. **Verify from the host:** Confirm outbound TCP port `25` connects instead of timing out:
   ```bash
   nc -4 -vz -w 5 gmail-smtp-in.l.google.com 25
   ```
6. **Create a `postmaster@yourdomain.com` mailbox or alias:** Ensures DMARC aggregate reports and RFC bounces are accepted instead of rejected with `550 5.1.1 User unknown`.

Copy `.env.example` to `.env`. Set `POSTGRES_DB=freemailo` and `POSTGRES_USER=freemailo` (the daemon SQL maps currently use these names). Generate distinct secrets with `openssl rand -hex 32`. Set `DATABASE_URL` to the `postgres` Compose hostname and URL-encode any non-hex password. Never use `.env.dev` on a public server.

Required production settings:

- `ALLOWED_ORIGINS=https://mail.yourdomain.com,https://webmail.yourdomain.com` — allowed browser origins for CORS & CSRF; comma-separated.
- `APP_URL=https://mail.yourdomain.com` — primary public webmail application URL.
- `MAIL_HOSTNAME=mail.yourdomain.com`, `MAIL_DOMAIN=yourdomain.com`.
- `JWT_SECRET` (32+ characters), `JWT_ACCESS_EXPIRY=15m`, `JWT_REFRESH_EXPIRY=7d`.
- Unique `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `RSPAMD_PASSWORD`, `DOVECOT_MASTER_PASSWORD`; optional `DOVECOT_MASTER_USER` defaults to `freemailo_master`.
- `MAIL_TLS_REJECT_UNAUTHORIZED=true`, `MAIL_TLS_SERVERNAME=mail.yourdomain.com`, `COOKIE_SECURE=true`.

The API rejects insecure production cookie/TLS settings and missing secrets. For a private mail CA, mount a CA bundle into the API and set `NODE_EXTRA_CA_CERTS` in its Compose environment. The development override explicitly permits the local self-signed certificate and HTTP cookies.

## TLS and startup

A single server TLS certificate issued for `MAIL_HOSTNAME` (e.g. `mail.yourdomain.com`) is shared across **three separate services**—regardless of how many virtual email domains you host in the Admin UI:

1. **Nginx (Host Reverse Proxy, Port `443`):** Serves the Webmail & Admin UI over HTTPS (`/api/` → `127.0.0.1:4000`, `/` → `127.0.0.1:3000`). Certbot configures Nginx directly.
2. **Postfix (Container, Ports `25`, `465`, `587`):** Encrypts inbound/outbound SMTP and authenticated submission using `certs/mail.crt` and `certs/mail.key` mounted read-only at `/etc/ssl/mail/`.
3. **Dovecot (Container, Port `993`):** Encrypts IMAPS connections—used both by external mail clients (Thunderbird, Apple Mail) **and** by the FreeMailo API (`freemailo-api`) when authenticating mailbox logins.

Because `NODE_ENV=production` enforces `MAIL_TLS_REJECT_UNAUTHORIZED=true` and verifies Dovecot against `MAIL_TLS_SERVERNAME` (`${MAIL_HOSTNAME}`), leaving a self-signed certificate inside `certs/` after enabling HTTPS causes mailbox login to fail with `"Mailbox authentication is temporarily unavailable"` (`DEPTH_ZERO_SELF_SIGNED_CERT`).

### Option A: Let's Encrypt (Certbot + Nginx + Automated Mail Sync)

1. Configure Nginx on the host to proxy `mail.yourdomain.com` to the containers (`127.0.0.1:4000` for `/api/` and `127.0.0.1:3000` for `/`, with `proxy_buffering off;` on `/api/mail/events` for SSE), then obtain the certificate:
   ```nginx
   server {
       listen 80;
       listen [::]:80;
       server_name mail.yourdomain.com;
       client_max_body_size 50M;

       location /api/mail/events {
           proxy_pass http://127.0.0.1:4000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_buffering off;
           proxy_read_timeout 3600s;
       }

       location /api/ {
           proxy_pass http://127.0.0.1:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   ```bash
   sudo certbot --nginx -d mail.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com --redirect
   ```
2. **Sync the Let's Encrypt certificate into `certs/` immediately** (required because Docker containers cannot read root-owned `/etc/letsencrypt/` directly):
   ```bash
   sudo ./scripts/sync-certs-to-mail.sh
   ```
   `scripts/sync-certs-to-mail.sh` reads `MAIL_HOSTNAME` from `.env` (or `RENEWED_LINEAGE` from Certbot), copies `fullchain.pem` → `certs/mail.crt` (`0644`) and `privkey.pem` → `certs/mail.key` (`0600`), preserves repository ownership, and restarts `dovecot` and `postfix`.
3. **Automate future 90-day renewals:** Symlink `scripts/sync-certs-to-mail.sh` (or use `scripts/renew-mail-certs.sh`, which reloads Postfix/Dovecot and refreshes the pinned relay certificate) as a Certbot deploy hook, then test with a dry run:
   ```bash
   sudo ln -sf "$(pwd)/scripts/sync-certs-to-mail.sh" /etc/letsencrypt/renewal-hooks/deploy/01-sync-freemailo-certs.sh
   sudo certbot renew --dry-run
   ```

### Option B: Commercial / Purchased SSL Certificate

If you purchased a commercial certificate instead of using Let's Encrypt, you do not need Certbot or renewal hooks: install your CA full chain as `certs/mail.crt` (`0644`), your private key as `certs/mail.key` (`0600`), and restart Postfix and Dovecot (`docker compose restart dovecot postfix`).

### DH Parameters & Initial Stack Startup

Generate `certs/dhparams.pem` once with `openssl dhparam -out certs/dhparams.pem 2048` (`0644`); Postfix startup requires `mail.crt`, `mail.key`, and `dhparams.pem`. Ensure `certs/` contains valid certificates before starting the mail stack (or use `./scripts/generate-certs.sh ./certs mail.yourdomain.com` only as a temporary bootstrap before running `sync-certs-to-mail.sh`).

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
