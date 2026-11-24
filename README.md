# FreeMailo

Self-hosted, multi-domain email built with Postfix, Dovecot, Rspamd, PostgreSQL, Redis, NestJS and Next.js. The existing application has been revised across phases 0–7; see the [review and acceptance evidence](docs/application-review.md) and [deployment runbook](docs/deployment-runbook.md).

## Local development

Requires Docker Compose v2, Node.js 24.15, and Python 3 with `requests` for integration tests. Copy `.env.example` to `.env` or use the development `.env` on a private development machine.

```bash
# Generate development certificates once. Preserve existing certificates.
./scripts/generate-certs.sh ./certs mail.example.test

# Initialize the database before starting the API.
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml --profile tools run --rm --build migrate
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml --profile tools run --rm -e SEED_DEVELOPMENT=true -e NODE_ENV=development migrate npx ts-node prisma/seed.ts
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

The development seed creates missing accounts without replacing existing passwords. It cannot run with `NODE_ENV=production`. On a fresh database, create domains through the admin API/UI to provision their DKIM keys; the example seed domain is for local delivery testing.

| Service | Address | Development account |
| --- | --- | --- |
| Webmail | http://localhost:3000 | `alice@example.test` / `alice123456`, `bob@example.test` / `bob123456` |
| Administration | http://localhost:3000/admin | `admin@freemailo.local` / `admin123456` |
| Database Client (Adminer) | http://localhost:8080 | System: PostgreSQL, Server: `postgres`, User: `freemailo` |
| API documentation | http://localhost:4000/api/docs | Bearer token or browser cookie session |
| Health | http://localhost:4000/api/health | Reports DB, Redis, Postfix, Dovecot and Rspamd status |
| Metrics | http://localhost:4000/api/metrics | Restrict access in production |
| Submission / IMAP | 587 STARTTLS, 465 TLS / 993 TLS | Mailbox credentials |

### Environment Variables & Secret Rules

Copy `.env.example` to `.env`. All passwords and secrets should be generated using `openssl rand -hex 32` (or 16).

| Variable | Min Length | Rules & Format | Description |
| :--- | :--- | :--- | :--- |
| **`JWT_SECRET`** | **32 chars** | Alphanumeric / hex. In production, cannot contain `dev_`, `change`, or `example`. | Used by API to sign and verify user authentication tokens. |
| **`DOVECOT_MASTER_PASSWORD`** | 16+ chars | Alphanumeric / hex. No newlines (`\n`) or special quotes. | Master password allowing the API to authenticate to Dovecot IMAP. |
| **`RSPAMD_PASSWORD`** | 16+ chars | Alphanumeric / hex. No newlines (`\n` or `\r`). | Password for Rspamd controller API and Sieve learning integration. |
| **`POSTGRES_PASSWORD`** | 16+ chars | Hex or URL-encoded alphanumeric. Must match `DATABASE_URL`. | PostgreSQL database user password. |
| **`REDIS_PASSWORD`** | 16+ chars | Hex / alphanumeric. | Redis authentication password. |

> **Quick secret generation:**
> ```bash
> # Generate a 64-character (256-bit) secret for JWT_SECRET:
> openssl rand -hex 32
>
> # Generate 32-character secrets for DOVECOT_MASTER_PASSWORD and RSPAMD_PASSWORD:
> openssl rand -hex 16
> ```

---

## Implemented behavior

- Mail list, server-side sorting and pagination, search, MIME attachments, drafts, send/reply/forward, flags, move/trash and IMAP IDLE notifications.
- Gmail-style layout, responsive reading pane and compose window, keyboard navigation, settings, labels and trusted senders. HTML is sanitized and displayed in a sandboxed iframe; remote images require consent.
- Dovecot-authorized mailbox login, short-lived access tokens in HttpOnly cookies, rotating refresh tokens, CSRF protection and API rate limits.
- Admin domain/mailbox/alias management, asynchronous provisioning, retries/dead-letter jobs, audit records and DNS diagnostics. Private DKIM keys stay on the mail volume and are redacted from API responses.
- Password changes, signatures, contacts and vacation replies applied through ManageSieve, with certificate-authorized SMTP for server-generated replies.
- Non-root API/web images, persistent mail queue and data volumes, dependency checks, structured logs and recovery scripts.

This is not complete Gmail feature parity. The review records remaining product gaps and production release gates; automated accessibility checks are not a full accessibility certification.

## Verification

```bash
npm ci
npm --prefix apps/api ci
npm --prefix apps/web ci
bash scripts/generate-prisma.sh
npm run lint
npm run typecheck
npm test
npm run build
npm --prefix apps/api audit
npm --prefix apps/web audit

# Against the running development stack; these create test mail/accounts.
python3 scripts/test-phase2.py
python3 scripts/test-phase3.py
python3 scripts/test-revision.py
python3 scripts/test-open-relay.py
python3 scripts/test-smtp-policy.py
python3 scripts/test-authentication-headers.py
python3 scripts/test-vacation.py
python3 scripts/test-spam-learning.py
python3 scripts/test-spam-rejection.py
npm --prefix apps/web exec -- playwright install chromium
cd apps/web && npx playwright test --workers=1
```

`node scripts/test-mail-load.cjs` provisions an isolated 10,000-message mailbox and measures list latency and realtime delivery. It archives the temporary mailbox afterward. Use the load test on development infrastructure.

## Production DNS & Domain Management

FreeMailo is natively multi-domain. You can host multiple domains on the same server without restarting Docker or changing configuration files.

### 1. Adding Domains & Getting DNS Records (1-Click)
1. Log into the Admin UI: `http://<server-ip>:3000/admin` (or `https://mail.yourdomain.com/admin`).
2. Go to **Domains** (`/admin/domains`) and click **+ Add Domain**.
3. Enter your domain name (e.g. `ramankumarkheti.com`). FreeMailo's background worker automatically generates a dedicated 2048-bit RSA DKIM key pair (`freemailo._domainkey`) and saves it securely to persistent storage (`/var/lib/rspamd/dkim/`).
4. Click the **DNS Setup** (📄) icon next to your domain. A modal opens with 1-click copy buttons for your DNS provider (e.g. Hostinger, Cloudflare):
   - **A Record (`mail`):** Points to your VPS Public IP (serves both email traffic on ports 25/587/993 and Webmail UI on ports 80/443).
   - **MX Record (`@`):** Points to `mail.yourdomain.com` (Priority 10).
   - **TXT Record (`freemailo._domainkey`):** DKIM public key (`v=DKIM1; k=rsa; p=...`).
   - **TXT Record (`@`):** SPF authorization (`v=spf1 mx ~all`).
   - **TXT Record (`_dmarc`):** DMARC security policy (`v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com; pct=100`).
5. In your VPS provider dashboard (Hetzner, Hostinger VPS, DigitalOcean, etc.), set **Reverse DNS (PTR)** for your IPv4 address to `mail.yourdomain.com`.
6. Click **Verify DNS** in the FreeMailo modal to verify live propagation.

### 2. Creating New Email Accounts (Mailboxes)
1. In the Admin UI, go to **Mailboxes** (`/admin/mailboxes`).
2. Click **+ Add Mailbox**:
   - Select your domain from the dropdown.
   - Enter your username / local part (e.g. `raman` for `raman@ramankumarkheti.com`).
   - Set a secure password and storage quota (default 1024 MB / 1 GB).
3. Click **Create Mailbox**. FreeMailo immediately provisions the account in PostgreSQL and creates the Maildir folders on disk.
4. Users can log into webmail at `http://<server-ip>:3000/login` or connect their mobile/desktop email app (Apple Mail, Outlook, Thunderbird) using IMAP (port 993, SSL/TLS) and SMTP (port 587, STARTTLS).

## Deployment and recovery

Production uses `.env.example`, unique secrets, verified mail TLS and web HTTPS. Follow the [runbook](docs/deployment-runbook.md) to migrate, bootstrap an administrator, configure DNS, and verify external delivery. The development seed and self-signed certificates are not production defaults.

```bash
# Briefly stops mail/API/Redis writers and resumes them after snapshotting.
./scripts/backup.sh /secure/backup-directory

# Uses disposable resources; never overwrites the live deployment.
./scripts/test-restore-isolated.sh /secure/backup-directory
```

Backups contain SQL, Maildir, Rspamd/DKIM, Postfix queue and Redis persistence with SHA256 checksums. Keep encrypted off-host copies. Actual restoration requires a stopped stack and the explicit operator flag documented in the runbook.

## Documentation

- [Phase 0–7 review and evidence](docs/application-review.md)
- [Deployment and recovery](docs/deployment-runbook.md)
- [Architecture](docs/architecture.md)
- [API specification](docs/api-specification.yaml)
- [DNS setup](docs/dns-setup-guide.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Risk analysis](docs/risks.md)
