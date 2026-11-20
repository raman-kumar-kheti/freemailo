# MailHive

A production-ready, self-hosted multi-domain email hosting platform with a Gmail-style webmail UI.

## Features

- **Multi-domain support** — Host email for multiple domains with virtual users
- **Gmail-style webmail** — Modern, responsive UI with threads, labels, search, and keyboard shortcuts
- **Full mail stack** — Postfix (SMTP), Dovecot (IMAP/LMTP), Rspamd (spam filtering)
- **Admin dashboard** — Manage domains, mailboxes, aliases, and monitor delivery
- **Security first** — DKIM signing, SPF/DMARC verification, TLS everywhere, Argon2id passwords
- **Docker Compose** — One-command deployment with production and development configurations

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full architecture document.

```
Internet ──► Postfix (25) ──► Rspamd ──► Dovecot LMTP ──► Maildir
                                              │
Browser ──► Next.js ──► NestJS API ──► Dovecot IMAP (993)
                           │
                    PostgreSQL + Redis
```

## Quick Start

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your settings

# Start all services
docker compose up -d

# Run database migrations
docker compose exec api npx prisma migrate deploy

# Create initial admin
docker compose exec api npm run seed
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| MTA (SMTP) | Postfix |
| MDA/IMAP | Dovecot |
| Spam Filter | Rspamd |
| Frontend | Next.js + React + TypeScript |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| Queue | Redis + BullMQ |
| Containers | Docker Compose |

## Documentation

- [Architecture](docs/architecture.md)
- [API Specification](docs/api-specification.yaml)
- [Risk Analysis](docs/risks.md)
- [DNS Setup Guide](docs/dns-setup.md)
- [Deployment Runbook](docs/deployment-runbook.md)
- [Troubleshooting](docs/troubleshooting.md)

## Development

```bash
# Start development environment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Frontend
cd apps/web && npm run dev

# Backend
cd apps/api && npm run start:dev
```

## License

MIT
