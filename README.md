# MailHive 📬

[![Architecture: Production-Ready](https://img.shields.io/badge/Architecture-Production--Ready-blue.svg)](#architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)
[![WCAG 2.1 AA Compliant](https://img.shields.io/badge/A11y-WCAG%202.1%20AA-success.svg)](#accessibility)

**MailHive** is an enterprise-grade, self-hosted, multi-domain email platform pairing a modern mail server core (Postfix, Dovecot, Rspamd, PostgreSQL, Redis) with a Gmail-style Next.js webmail interface and an intuitive administration dashboard.

---

## 🏛 Architecture Overview

```mermaid
flowchart TD
    subgraph "Public Internet"
        ExternalMTA["External Mail Servers"]
        ClientBrowser["User Browser (Webmail & Admin)"]
    end

    subgraph "Frontend Network (:3000)"
        Web["Next.js Webmail & Admin UI\n(App Router / Tailwind / Radix)"]
    end

    subgraph "Application Network (:4000)"
        API["NestJS Backend API\n(BullMQ / ImapFlow / Nodemailer / Throttler)"]
        Postgres[("PostgreSQL 16\n(Accounts, Domains, Aliases, Audits)")]
        Redis[("Redis 7\n(BullMQ, Caching, Rate Limits)")]
    end

    subgraph "Mail Network"
        Postfix["Postfix MTA\n(SMTP 25, 465, 587)"]
        Dovecot["Dovecot MDA / IMAP\n(IMAP 993 TLS, LMTP 24)"]
        Rspamd["Rspamd Milter\n(DKIM Signing, SPF/DMARC, Redis cache)"]
        Vmail[("Maildir Storage\n(/var/vmail/<domain>/<user>)")]
    end

    ExternalMTA -->|Port 25 (Inbound SMTP)| Postfix
    Postfix -->|Milter 11332| Rspamd
    Postfix -->|LMTP 24| Dovecot
    Dovecot --> Vmail

    ClientBrowser -->|HTTP 3000| Web
    Web -->|HTTP Rewrites / Proxies| API
    API -->|Prisma ORM 5432| Postgres
    API -->|ioredis / BullMQ| Redis
    API -->|IMAP 993 (Master Auth)| Dovecot
    API -->|Submission 587 (Master Auth)| Postfix
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Docker Engine 24+ and Docker Compose v2+
- Node.js 20+ (for local development or CLI test suites)
- Python 3.10+ (for automated verification test suites)

### 2. Environment Configuration
Copy the development environment template:
```bash
cp .env.dev .env
```

Key environment configurations available in `.env.dev`:
- `MAIL_HOSTNAME`: FQDN of mail server (e.g. `mail.example.com`)
- `MAIL_DOMAIN`: Primary hosted domain (e.g. `example.com`)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: 32+ character cryptographically secure secret
- `DOVECOT_MASTER_USER` / `DOVECOT_MASTER_PASSWORD`: Master service credentials

### 3. Launch Services
Start the full MailHive stack in detached mode:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d
```

### 4. Database Setup & Seeding
Deploy database schemas and seed initial domain and accounts:
```bash
cd apps/api
npx prisma migrate deploy
npm run seed
```

---

## 🔑 Default Credentials & Access Endpoints

| Portal / Service | URL / Port | Default Credentials | Description |
|------------------|------------|---------------------|-------------|
| **Webmail UI** | [http://localhost:3000](http://localhost:3000) | `alice@example.test` / `alice123456`<br>`bob@example.test` / `bob123456` | Gmail-style webmail client |
| **Admin Console** | [http://localhost:3000/admin](http://localhost:3000/admin) | `admin@mailhive.local` / `admin123456` | Multi-domain & queue management |
| **Backend REST API** | [http://localhost:4000](http://localhost:4000) | Bearer JWT Authentication | NestJS Core Services |
| **Swagger API Docs** | [http://localhost:4000/api/docs](http://localhost:4000/api/docs) | Public | Interactive OpenAPI 3.1 Documentation |
| **Health Check** | [http://localhost:4000/api/health](http://localhost:4000/api/health) | Public | Postfix, Dovecot, DB & Redis health |
| **Prometheus Metrics**| [http://localhost:4000/api/metrics](http://localhost:4000/api/metrics) | Public | Scrape endpoint for Prometheus |
| **Inbound SMTP** | `localhost:25` | Opportunistic STARTTLS | Inbound internet MX |
| **Outbound Submission**| `localhost:587` | STARTTLS + SASL PLAIN | Authenticated client submission |
| **Dovecot IMAPS**| `localhost:993` | Implicit TLS + PLAIN / Master User | Mail retrieval & folder management |

---

## ✨ Features & User Experience

### Gmail-Style Webmail Interface (`apps/web`)
- **Reading Pane & Sandboxed Viewer:** Strict CSP iframe isolating untrusted HTML and SVG; remote image blocker gate ("Display images", "Always trust sender").
- **Security Pills:** Realtime SPF, DKIM, and DMARC status pills parsed directly from `Authentication-Results` RFC headers.
- **Floating Compose Modal:** Dockable bottom-right compose window with minimize, maximize, attachment support, contact auto-complete, and 20s draft autosave.
- **Fast Keyboard Shortcuts:** Full Gmail keyboard shortcut parity:
  - `c` — Compose new email
  - `j` / `k` — Navigate messages down / up
  - `o` / `Enter` — Open selected message
  - `e` — Archive message
  - `#` — Delete message
  - `s` — Star / unstar message
  - `/` — Focus search input
  - `?` — Open keyboard shortcuts cheat sheet
- **Accessibility:** Zero critical or serious WCAG 2.1 AA violations verified via automated `@axe-core/playwright` audits.

### Administration Console (`/admin`)
- **Domain Wizard & DNS Diagnostics:** Generates 2048-bit RSA DKIM keys automatically, provides copyable DNS records (MX, SPF, DKIM, DMARC, PTR), and performs live DNS validation checks.
- **Mailbox & Alias Management:** Provision mailboxes with custom storage quotas, reset passwords with Argon2id `{ARGON2ID}`, and configure virtual alias forwards.
- **Provisioning Queue Monitor:** BullMQ worker job monitoring (`COMPLETED`, `RUNNING`, `FAILED/DLQ`) with automatic exponential retry.
- **Immutable Audit Trail:** Comprehensive event log tracking mailbox provisioning, domain modifications, and administrative logins.

---

## 🛡 Security & Hardening

1. **Authentication:**
   - Super Admin & Mailbox multi-role JWT tokens (15m access token expiry).
   - Rotating refresh tokens stored in secure, `httpOnly`, `SameSite=Lax` cookies.
   - Argon2id password hashing compatible with Dovecot's native verification.
2. **Master User Authentication:**
   - Backend connects to Dovecot IMAP (993) and Postfix SASL (587) via Dovecot Master User credentials (`auth_master_user_separator = *`). User plaintext passwords are never stored or retained by the backend.
3. **Rate Limiting:**
   - NestJS Throttler protects API endpoints against denial-of-service and credential stuffing attacks (30 req/sec burst, 200 req/min sustained).
4. **Content Security Policy (CSP):**
   - Sandboxed email rendering within an isolated iframe preventing script execution, cookie access, and cross-site tracking.

---

## 💾 Backup & Restore Pipeline

MailHive provides an automated backup and restore pipeline for PostgreSQL metadata and Maildir storage.

### Create a Backup
```bash
./scripts/backup.sh [OPTIONAL_OUTPUT_DIR]
```
- Creates timestamped, gzip-compressed database dumps (`mailhive_db_<timestamp>.sql.gz`).
- Creates compressed Maildir storage archives (`mailhive_vmail_<timestamp>.tar.gz`).
- Computes SHA256 checksums and writes JSON metadata with file sizes.
- Keeps latest symlink (`latest.json`).

### Restore from Backup
```bash
./scripts/restore.sh [TIMESTAMP|latest]
```
- Verifies SHA256 integrity before touching storage or databases.
- Restores PostgreSQL schemas and records.
- Extracts and restores `/var/vmail` with proper `vmail:vmail` permissions (`5000:5000`).
- Flushes Dovecot auth caches and forces index synchronization.

---

## 🧪 Verification & Acceptance Test Suites

MailHive includes a comprehensive suite of real end-to-end integration and browser tests:

```bash
# 1. Verify Backend Provisioning & BullMQ (Phase 2)
python3 scripts/test-phase2.py

# 2. Verify Mail API, IMAP Operations, and Outbound SMTP (Phase 3)
python3 scripts/test-phase3.py

# 3. Verify Backup & Restore Pipeline with Real Data Recovery (Phase 6)
./scripts/test-backup-restore.py

# 4. Verify Webmail, Admin UI, and Accessibility (Playwright E2E)
cd apps/web && npx playwright test
```

---

## 📚 Documentation Guides

- [Architecture & Design Specifications](docs/architecture.md)
- [OpenAPI 3.1 Specification](docs/api-specification.yaml)
- [DNS & Deliverability Setup Guide](docs/dns-setup-guide.md)
- [Production Deployment Runbook](docs/deployment-runbook.md)
- [Troubleshooting & Diagnostics](docs/troubleshooting.md)
- [Security & Risk Analysis](docs/risks.md)

---

## 📄 License
This project is licensed under the MIT License.
