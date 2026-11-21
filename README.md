# MailHive

Self-hosted, multi-domain email built with Postfix, Dovecot, Rspamd, PostgreSQL, Redis, NestJS and Next.js. The existing application has been revised across phases 0–7; see the [review and acceptance evidence](docs/application-review.md) and [deployment runbook](docs/deployment-runbook.md).

## Local development

Requires Docker Compose v2, Node.js 24.15, and Python 3 with `requests` for integration tests. `.env.dev` contains **public development credentials**; use it only on a private development machine.

```bash
# Generate development certificates once. Preserve existing certificates.
./scripts/generate-certs.sh ./certs mail.example.test

# Initialize the database before starting the API.
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml --profile tools run --rm --build migrate
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml --profile tools run --rm -e SEED_DEVELOPMENT=true -e NODE_ENV=development migrate npx ts-node prisma/seed.ts
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

The development seed creates missing accounts without replacing existing passwords. It cannot run with `NODE_ENV=production`. On a fresh database, create domains through the admin API/UI to provision their DKIM keys; the example seed domain is for local delivery testing.

| Service | Address | Development account |
| --- | --- | --- |
| Webmail | http://localhost:3000 | `alice@example.test` / `alice123456`, `bob@example.test` / `bob123456` |
| Administration | http://localhost:3000/admin | `admin@mailhive.local` / `admin123456` |
| API documentation | http://localhost:4000/api/docs | Bearer token or browser cookie session |
| Health | http://localhost:4000/api/health | Reports DB, Redis, Postfix, Dovecot and Rspamd status |
| Metrics | http://localhost:4000/api/metrics | Restrict access in production |
| Submission / IMAP | 587 STARTTLS, 465 TLS / 993 TLS | Mailbox credentials |

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
