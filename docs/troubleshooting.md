# MailHive Troubleshooting & Diagnostic Guide 🩺

This guide provides systematic troubleshooting instructions for diagnosing and resolving common operational issues in Postfix, Dovecot, Rspamd, Redis, and Webmail.

---

## 🔍 Diagnostic Commands Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| **System Health** | `curl -s http://localhost:4000/api/health \| jq .` | Checks Postgres, Redis, Postfix, Dovecot status |
| **Postfix Queue** | `docker exec mailhive-postfix postqueue -p` (or `mailq`) | Lists queued outbound messages |
| **Flush Queue** | `docker exec mailhive-postfix postfix flush` | Attempts immediate delivery for all queued mail |
| **Purge Queue** | `docker exec mailhive-postfix postsuper -d ALL` | Deletes all queued mail |
| **Dovecot Auth Test** | `docker exec mailhive-dovecot doveadm auth test <email> <password>` | Verifies mailbox credentials |
| **Dovecot Resync** | `docker exec mailhive-dovecot doveadm force-resync -u <email> INBOX` | Rebuilds corrupted mailbox indexes |
| **Rspamd Stats** | `docker exec mailhive-rspamd rspamc stat` | Displays spam filtering throughput & scores |
| **Rspamd Scan** | `docker exec -i mailhive-rspamd rspamc < /path/to/email.eml` | Runs full spam & DKIM checks on raw MIME email |
| **Tail Postfix Logs** | `docker logs -f mailhive-postfix` | Inspects live SMTP transactions |
| **Tail Dovecot Logs** | `docker logs -f mailhive-dovecot` | Inspects live IMAP/LMTP connections |

---

## 🚨 Common Issues & Resolution

### 1. Inbound Emails Not Arriving

#### Symptoms
- External senders receive bounced mail (`554 5.7.1 Relay access denied` or `Connection timed out`).
- Mailbox INBOX remains empty.

#### Diagnostic Steps
1. Verify MX record resolution:
   ```bash
   dig MX yourdomain.com +short
   ```
   Ensure it points to `mail.yourdomain.com.`, not an IP address.
2. Check if Postfix is listening on Port 25:
   ```bash
   nc -zv your-server-ip 25
   ```
3. Check Postfix container logs:
   ```bash
   docker logs --tail 100 mailhive-postfix | grep -i "reject"
   ```
4. If you see `Relay access denied`:
   - Ensure the domain is added to PostgreSQL:
     ```bash
     docker exec -i mailhive-postgres psql -U mailhive -d mailhive -c "SELECT name, \"isActive\" FROM domains;"
     ```
   - Verify Postfix pgsql query:
     ```bash
     docker exec mailhive-postfix postmap -q "yourdomain.com" pgsql:/etc/postfix/pgsql-virtual-mailbox-domains.cf
     ```
     Should output `yourdomain.com`.

---

### 2. Outbound Emails Marked as Spam by Gmail / Outlook

#### Symptoms
- Sent emails land in Spam / Junk folders.
- Google bounces with `550-5.7.26 This message does not pass authentication checks (SPF and DKIM)`.

#### Resolution Steps
1. **Check Reverse DNS (rDNS):**
   ```bash
   dig -x YOUR_PUBLIC_IP +short
   ```
   Must match `mail.yourdomain.com.`.
2. **Validate DKIM Signature:**
   Check the headers of the received email. Look for:
   ```
   Authentication-Results: mx.google.com;
       dkim=pass header.i=@yourdomain.com header.s=mailhive ...
   ```
   If DKIM fails or is missing:
   - Check if DKIM key exists in Rspamd:
     ```bash
     docker exec mailhive-rspamd ls -la /var/lib/rspamd/dkim/
     ```
   - Verify selector in `docker/rspamd/local.d/dkim_signing.conf` matches DNS selector (`mailhive`).
3. **Verify SPF Record:**
   ```bash
   dig TXT yourdomain.com +short | grep "v=spf1"
   ```
   Must contain your server's sending IP (`ip4:<IP>`).

---

### 3. "Cached message size larger than expected" Dovecot Error

#### Symptoms
- IMAP client or Webmail throws `FETCH failed: Internal error occurred`.
- Dovecot logs report:
  `Mailbox INBOX: UID=x: read(...) failed: Cached message size larger than expected (500 > 369)`.

#### Cause
A message was placed into the Maildir with an invalid `,S=<size>` flag that does not match the file's actual byte length.

#### Resolution
Force Dovecot to rebuild and resync its mailbox index:
```bash
docker exec mailhive-dovecot doveadm force-resync -u <user@domain.com> INBOX
```
To resync all mailboxes across all accounts:
```bash
docker exec mailhive-dovecot doveadm force-resync -A '*'
```

---

### 4. BullMQ Provisioning Jobs Stuck or Failed

#### Symptoms
- Newly created mailbox or domain shows as "PROVISIONING" or fails to generate DKIM keys.

#### Diagnostic Steps
1. Check Admin Jobs UI:
   Navigate to `/admin/jobs` to inspect the Failed / DLQ tabs and view error stack traces.
2. Check Redis connectivity from API:
   ```bash
   docker exec -it mailhive-api node -e "
     const Redis = require('ioredis');
     const redis = new Redis({ host: 'redis', port: 6379, password: process.env.REDIS_PASSWORD });
     redis.ping().then(console.log).then(() => redis.quit());
   "
   ```
3. Inspect worker logs:
   ```bash
   docker logs --tail 100 mailhive-api | grep -i "provisioning"
   ```

---

### 5. API Rate Limiting (HTTP 429 Too Many Requests)

#### Symptoms
- Clients or webmail get HTTP 429 errors during bulk requests.

#### Resolution
- Default limits are:
  - Burst: 30 requests / second.
  - Sustained: 200 requests / minute.
- To adjust, update `ThrottlerModule` configuration in `apps/api/src/app.module.ts`:
  ```ts
  ThrottlerModule.forRoot([
    { name: 'short', ttl: 1000, limit: 50 },
    { name: 'medium', ttl: 60000, limit: 500 },
  ])
  ```
  Rebuild and restart the API container:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d --build api
  ```
