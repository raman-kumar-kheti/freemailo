# MailHive Production Deployment Runbook 🚀

This runbook guides system administrators through deploying MailHive onto a clean Linux VPS (Ubuntu 22.04 / 24.04 LTS or Debian 12) with Let's Encrypt TLS certificates, firewall security, automated cron backups, and production tuning.

---

## 📋 System Requirements

- **OS:** Ubuntu 22.04 / 24.04 LTS or Debian 12
- **CPU:** Minimum 2 vCPUs (4 vCPUs recommended for >50 users)
- **RAM:** Minimum 4 GB RAM (Rspamd + Redis + NestJS + Next.js + Dovecot)
- **Disk:** 40+ GB SSD (scale according to mailbox volume)
- **Network:** Static IPv4 address with reverse DNS (PTR) capability; Port 25 unblocked by host (verify cloud provider has opened outbound port 25).

---

## 🔒 1. Firewall Configuration (UFW)

Enable standard ports while restricting administrative ports to trusted management IPs:

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow Webmail & Reverse Proxy (HTTP & HTTPS)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Public Mail Ports
sudo ufw allow 25/tcp    # Inbound SMTP
sudo ufw allow 465/tcp   # SMTPS (Implicit TLS)
sudo ufw allow 587/tcp   # Submission (STARTTLS)
sudo ufw allow 993/tcp   # IMAPS (Implicit TLS)
sudo ufw allow 4190/tcp  # ManageSieve (Optional)

# Enable UFW
sudo ufw enable
```

> [!CAUTION]
> Never expose PostgreSQL (`5432`) or Redis (`6379`) to the public internet! MailHive compose networks (`appnet`, `mailnet`) isolate these internally.

---

## 🔐 2. TLS / SSL Certificates (Let's Encrypt with Certbot)

Install Certbot to obtain valid trusted certificates for your mail hostname (e.g. `mail.yourdomain.com`):

```bash
sudo apt update && sudo apt install -y certbot

# Request certificate using standalone mode (make sure port 80 is temporarily free)
sudo certbot certonly --standalone -d mail.yourdomain.com -d webmail.yourdomain.com

# Create certs directory in MailHive project root
mkdir -p certs

# Link or copy certificates into ./certs/
sudo cp /etc/letsencrypt/live/mail.yourdomain.com/fullchain.pem ./certs/cert.pem
sudo cp /etc/letsencrypt/live/mail.yourdomain.com/privkey.pem ./certs/key.pem
sudo chmod 600 ./certs/key.pem
sudo chmod 644 ./certs/cert.pem
```

### Automated Renewal Hook
Create `/etc/letsencrypt/renewal-hooks/deploy/mailhive-reload.sh`:
```bash
#!/bin/bash
PROJECT_DIR="/opt/mailhive"
cp /etc/letsencrypt/live/mail.yourdomain.com/fullchain.pem ${PROJECT_DIR}/certs/cert.pem
cp /etc/letsencrypt/live/mail.yourdomain.com/privkey.pem ${PROJECT_DIR}/certs/key.pem
chmod 600 ${PROJECT_DIR}/certs/key.pem
chmod 644 ${PROJECT_DIR}/certs/cert.pem
docker exec mailhive-postfix postfix reload
docker exec mailhive-dovecot doveadm reload
```
Make it executable:
```bash
chmod +x /etc/letsencrypt/renewal-hooks/deploy/mailhive-reload.sh
```

---

## ⚙️ 3. Production Environment File (`.env`)

Generate strong secrets and configure `.env`:

```bash
# Generate high-entropy secrets
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 24  # For POSTGRES_PASSWORD
openssl rand -hex 24  # For REDIS_PASSWORD
openssl rand -hex 24  # For RSPAMD_PASSWORD
openssl rand -hex 24  # For DOVECOT_MASTER_PASSWORD
```

Save to `.env`:
```ini
NODE_ENV=production
MAIL_HOSTNAME=mail.yourdomain.com
MAIL_DOMAIN=yourdomain.com
MESSAGE_SIZE_LIMIT=52428800 # 50 MB

# Postgres
POSTGRES_DB=mailhive
POSTGRES_USER=mailhive
POSTGRES_PASSWORD=<STRONG_POSTGRES_PASSWORD>
DATABASE_URL=postgresql://mailhive:<STRONG_POSTGRES_PASSWORD>@postgres:5432/mailhive?schema=public

# Redis
REDIS_PASSWORD=<STRONG_REDIS_PASSWORD>

# Rspamd
RSPAMD_PASSWORD=<STRONG_RSPAMD_PASSWORD>

# Dovecot Master Auth
DOVECOT_MASTER_USER=mailhive_master
DOVECOT_MASTER_PASSWORD=<STRONG_DOVECOT_MASTER_PASSWORD>

# JWT Authentication
JWT_SECRET=<STRONG_JWT_SECRET>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
APP_URL=https://webmail.yourdomain.com
```

---

## 🚀 4. Deployment Execution

```bash
# 1. Build and start containers
docker compose up -d --build

# 2. Run Database Migrations
docker compose exec api npx prisma migrate deploy

# 3. Create Super Admin Account
docker compose exec api npm run seed

# 4. Check Health Status
curl -s http://localhost:4000/api/health | jq .
```

---

## ⏰ 5. Automated Backups with Cron

Set up nightly automated backups at 02:00 AM using `cron`:

```bash
sudo crontab -e
```

Add the following entry:
```crontab
0 2 * * * /opt/mailhive/scripts/backup.sh /var/backups/mailhive >> /var/log/mailhive-backup.log 2>&1
```

### Offsite Sync (Optional but Recommended)
Sync backups to AWS S3 or Backblaze B2 using `rclone`:
```crontab
30 2 * * * rclone sync /var/backups/mailhive remote:my-mailhive-backups/
```

---

## 📈 6. Monitoring & Observability

- **Health Check Endpoint:** `GET /api/health`
  - Monitored by Uptime Kuma, Datadog, or Prometheus Blackbox exporter.
- **Prometheus Metrics:** `GET /api/metrics`
  - Scraped every 15s to chart memory, CPU, mailbox counts, and HTTP throughput.
