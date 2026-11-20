# MailHive — Risk Analysis

## Risk Matrix Summary

| Risk | Category | Impact | Likelihood | Residual |
|------|----------|--------|------------|----------|
| Open relay misconfiguration | Security | 🔴 High | Medium | Low |
| XSS through email HTML | Security | 🔴 High | High | Low |
| Email header injection | Security | 🔴 High | Medium | Low |
| JWT token theft | Security | 🟡 Medium | Medium | Low |
| Password brute force | Security | 🟡 Medium | High | Low |
| SQL injection in mail SQL maps | Security | 🔴 High | Low | Very Low |
| CSRF attacks | Security | 🟡 Medium | Medium | Low |
| TLS downgrade attacks | Security | 🟡 Medium | Low | Very Low |
| Privilege escalation | Security | 🔴 High | Low | Very Low |
| DNS spoofing/cache poisoning | Security | 🟡 Medium | Low | Low |
| IP reputation (new IP) | Deliverability | 🔴 High | High | Medium |
| Missing DNS records | Deliverability | 🔴 High | Medium | Low |
| Blacklisting | Deliverability | 🔴 High | Medium | Medium |
| Bounce handling failures | Deliverability | 🟡 Medium | Medium | Low |
| Disk space exhaustion | Operational | 🔴 High | Medium | Low |
| PostgreSQL pool exhaustion | Operational | 🟡 Medium | Medium | Low |
| Redis memory limits | Operational | 🟡 Medium | Medium | Low |
| Docker volume data loss | Operational | 🔴 High | Low | Very Low |
| Certificate expiry | Operational | 🟡 Medium | Medium | Low |
| Service interdependency | Operational | 🟡 Medium | Medium | Low |
| Large mailbox performance | Performance | 🟡 Medium | Medium | Low |
| IMAP connection pooling | Performance | 🟡 Medium | Medium | Low |
| Concurrent user scaling | Performance | 🟡 Medium | Low | Low |
| Attachment handling | Performance | 🟢 Low | Medium | Low |
| Data privacy (GDPR) | Compliance | 🟡 Medium | Medium | Medium |
| Email retention | Compliance | 🟡 Medium | Low | Low |
| Audit logging gaps | Compliance | 🟢 Low | Medium | Low |

---

## 1. Security Risks

### 1.1 Open Relay Misconfiguration

- **Description**: Postfix accepts and relays mail from unauthenticated sources to external destinations, allowing spammers to abuse the server.
- **Impact**: 🔴 **High** — Immediate blacklisting, legal liability, reputation destruction.
- **Likelihood**: Medium — Default Postfix is not an open relay, but misconfiguration during virtual domain setup is common.
- **Mitigation**:
  - `smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination`
  - `mynetworks` restricted to Docker internal networks only
  - Automated open-relay test in CI: attempt to relay through the server from an external address and verify rejection
  - Submission port (587) requires SASL authentication
- **Detection**: Open-relay test in test suite; monitoring outbound mail volume; external relay checkers (mxtoolbox).
- **Residual Risk**: Low — with correct restrictions and automated testing.

### 1.2 XSS Through Rendered Email HTML

- **Description**: Malicious HTML in email bodies executes JavaScript in the user's browser session.
- **Impact**: 🔴 **High** — Session hijacking, data theft, phishing from trusted context.
- **Likelihood**: High — HTML email is ubiquitous and attackers actively craft XSS payloads.
- **Mitigation**:
  - Server-side sanitization with DOMPurify (remove `<script>`, event handlers, `javascript:` URLs, `<object>`, `<embed>`, `<applet>`, data URIs)
  - Client-side re-sanitization before render
  - Render in sandboxed `<iframe sandbox="allow-same-origin">` with strict CSP
  - Block `<form>` elements in email HTML
  - Strip `<meta>` refresh tags
- **Detection**: CSP violation reports; Playwright tests with known XSS payloads.
- **Residual Risk**: Low — defense in depth with sanitize + sandbox + CSP.

### 1.3 Email Header Injection

- **Description**: User-supplied input (To, Cc, Subject) contains newline characters that inject additional headers or body content.
- **Impact**: 🔴 **High** — Spam sending, BCC injection, spoofed headers.
- **Likelihood**: Medium — Well-known attack vector, but requires direct input to header fields.
- **Mitigation**:
  - Strip `\r`, `\n`, and `\0` from all header inputs before passing to nodemailer
  - Validate email addresses with strict regex (RFC 5321)
  - Input validation with zod schemas on all mail-sending endpoints
  - Nodemailer itself encodes headers, but we validate before it
- **Detection**: Input validation logs; e2e tests with injection payloads.
- **Residual Risk**: Low.

### 1.4 JWT Token Theft

- **Description**: Access tokens are intercepted via XSS, network sniffing, or leaked in logs.
- **Impact**: 🟡 **Medium** — Account takeover for token lifetime (15 minutes).
- **Likelihood**: Medium — Requires another vulnerability (XSS) or network interception.
- **Mitigation**:
  - Short-lived access tokens (15 minutes)
  - Refresh tokens in `httpOnly`, `secure`, `SameSite=strict` cookies (not accessible to JS)
  - Token rotation on each refresh (old token invalidated)
  - TLS everywhere (no network sniffing)
  - Never log tokens; scrub from error reports
- **Detection**: Monitor for concurrent sessions from different IPs; refresh token reuse detection (if reused, revoke all tokens for that user).
- **Residual Risk**: Low.

### 1.5 Password Brute Force

- **Description**: Attacker tries many passwords against login endpoints or IMAP/SMTP auth.
- **Impact**: 🟡 **Medium** — Account compromise.
- **Likelihood**: High — Automated credential stuffing is common.
- **Mitigation**:
  - Rate limiting: 5 login attempts per minute per IP, 10 per account
  - Argon2id hashing (computationally expensive)
  - Account lockout after 20 failed attempts (30-minute cooldown)
  - Fail2ban monitoring Dovecot and Postfix auth logs
  - Minimum password length: 8 characters
- **Detection**: Failed login metrics; fail2ban alerts; audit log review.
- **Residual Risk**: Low.

### 1.6 SQL Injection in Postfix/Dovecot SQL Maps

- **Description**: Crafted email addresses or usernames exploit SQL queries in Postfix pgsql maps or Dovecot SQL auth.
- **Impact**: 🔴 **High** — Database compromise, data exfiltration.
- **Likelihood**: Low — Postfix and Dovecot use parameterized queries (`%s` and `%u`/`%d`).
- **Mitigation**:
  - All SQL map files use parameterized `%s`, `%u`, `%d` placeholders (never string interpolation)
  - Prisma uses parameterized queries for all application code
  - PostgreSQL user for mail lookups has SELECT-only permissions
  - Input validation on domain and local-part fields
- **Detection**: PostgreSQL query logging for anomalies; WAF rules.
- **Residual Risk**: Very Low.

### 1.7 CSRF Attacks

- **Description**: Forged cross-site requests perform state-changing actions (send mail, change password) using the victim's session.
- **Impact**: 🟡 **Medium** — Unauthorized actions on behalf of the user.
- **Likelihood**: Medium — Common web vulnerability.
- **Mitigation**:
  - `SameSite=strict` cookies prevent CSRF for refresh tokens
  - API uses Bearer tokens in `Authorization` header (not auto-sent by browsers)
  - CSRF tokens for any form-based submissions
  - CORS restricted to `APP_URL` only
  - Helmet security headers
- **Detection**: CORS violation logs; unexpected origin headers.
- **Residual Risk**: Low.

### 1.8 TLS Downgrade Attacks

- **Description**: Attacker forces SMTP/IMAP connections to fall back to plaintext.
- **Impact**: 🟡 **Medium** — Credential and email interception.
- **Likelihood**: Low — Requires active MITM position.
- **Mitigation**:
  - IMAP: TLS required (port 993 implicit, no plaintext IMAP)
  - SMTP submission (587): `smtpd_tls_security_level = encrypt` (mandatory)
  - Inbound SMTP (25): `smtpd_tls_security_level = may` (can't require for interop, but TLS offered)
  - Dovecot: `ssl = required`, `ssl_min_protocol = TLSv1.2`
  - MTA-STS policy published for inbound enforcement
- **Detection**: TLS connection metrics; monitoring non-TLS connections.
- **Residual Risk**: Very Low (inbound SMTP remains opportunistic per RFC).

### 1.9 Privilege Escalation

- **Description**: A mailbox user gains admin access or accesses another user's mailbox.
- **Impact**: 🔴 **High** — Full system compromise or data breach.
- **Likelihood**: Low — Requires JWT manipulation or authorization bypass.
- **Mitigation**:
  - Separate JWT claims for admin vs. mailbox users
  - Role-based guards on every endpoint
  - Admin and mailbox auth endpoints are separate
  - IMAP connections scoped to authenticated user only
  - Dovecot enforces per-user Maildir isolation
- **Detection**: Audit logs; unexpected admin API access patterns.
- **Residual Risk**: Very Low.

### 1.10 DNS Spoofing / Cache Poisoning

- **Description**: Attacker poisons DNS to redirect mail or fake domain verification.
- **Impact**: 🟡 **Medium** — Mail interception, fake domain verification.
- **Likelihood**: Low — DNSSEC and modern resolvers make this harder.
- **Mitigation**:
  - Recommend DNSSEC for hosted domains
  - Use trusted resolvers (e.g., 1.1.1.1 with DoH)
  - Domain verification uses multiple checks over time
  - SPF/DKIM/DMARC provide message-level authentication
- **Detection**: Monitor DNS responses; verification anomaly alerts.
- **Residual Risk**: Low.

---

## 2. Deliverability Risks

### 2.1 IP Reputation (New IP)

- **Description**: New sending IP has no reputation; major providers may reject or junk mail.
- **Impact**: 🔴 **High** — Mail doesn't reach recipients' inboxes.
- **Likelihood**: High — All new mail servers face this.
- **Mitigation**:
  - IP warmup plan: start with low volume, gradually increase over 4-6 weeks
  - Proper PTR/rDNS record matching the HELO hostname
  - SPF, DKIM, and DMARC from day one
  - Register with major feedback loops (Gmail Postmaster Tools, Microsoft SNDS)
  - Rate limiting outbound to prevent burst sending
  - Document the warmup process in deployment runbook
- **Detection**: Delivery rate monitoring; bounce analysis; postmaster tool dashboards.
- **Residual Risk**: Medium — takes time to build reputation, some initial deliverability issues expected.

### 2.2 Missing/Incorrect DNS Records

- **Description**: SPF, DKIM, DMARC, MX, or PTR records are missing or misconfigured.
- **Impact**: 🔴 **High** — Mail rejected or marked as spam by receiving servers.
- **Likelihood**: Medium — DNS configuration is error-prone.
- **Mitigation**:
  - Admin dashboard displays exact required DNS records per domain
  - Automated DNS verification checks (MX, SPF, DKIM, DMARC)
  - Clear DNS setup guide with copy-paste values
  - Warning banners for unverified domains
  - Periodic re-verification
- **Detection**: DNS verification dashboard; delivery bounce analysis.
- **Residual Risk**: Low — with tooling and documentation.

### 2.3 Blacklisting

- **Description**: Server IP appears on RBLs (Realtime Blackhole Lists) due to spam or abuse.
- **Impact**: 🔴 **High** — Widespread mail rejection.
- **Likelihood**: Medium — Can happen from compromised accounts or misconfiguration.
- **Mitigation**:
  - Rspamd scans outbound mail for spam characteristics
  - Rate limiting per mailbox (20 messages/minute)
  - Account suspension on abuse detection
  - No open relay (verified by tests)
  - Monitor blacklist status
- **Detection**: Periodic RBL checks; bounce message analysis; external monitoring services.
- **Residual Risk**: Medium — compromised accounts remain a risk despite mitigations.

### 2.4 Bounce Handling Failures

- **Description**: Excessive bounces or improper handling damages sender reputation.
- **Impact**: 🟡 **Medium** — Degraded deliverability.
- **Likelihood**: Medium — Bounces are normal, but mishandling amplifies the problem.
- **Mitigation**:
  - Postfix `bounce_queue_lifetime = 1d`, `maximal_queue_lifetime = 3d`
  - Double bounce handling: `double_bounce_sender = double-bounce`
  - Parse DSN (Delivery Status Notification) responses
  - Auto-disable mailboxes generating excessive bounces
- **Detection**: Bounce rate metrics; queue monitoring.
- **Residual Risk**: Low.

---

## 3. Operational Risks

### 3.1 Disk Space Exhaustion

- **Description**: Maildir storage, PostgreSQL WAL, or Docker volumes fill the disk.
- **Impact**: 🔴 **High** — Mail delivery stops, database corruption possible.
- **Likelihood**: Medium — Inevitable without monitoring and quotas.
- **Mitigation**:
  - Per-mailbox quotas enforced by Dovecot quota plugin
  - PostgreSQL WAL archiving with size limits
  - Redis `maxmemory` with `allkeys-lru` eviction
  - Docker volume monitoring
  - Disk usage alerts at 80% and 90% thresholds
  - Automated cleanup of old logs
- **Detection**: Prometheus disk metrics; Dovecot quota warnings; health checks.
- **Residual Risk**: Low.

### 3.2 PostgreSQL Connection Pool Exhaustion

- **Description**: Too many concurrent connections exceed PostgreSQL's `max_connections`.
- **Impact**: 🟡 **Medium** — API errors, failed provisioning.
- **Likelihood**: Medium — Multiple services connect (NestJS, Postfix, Dovecot).
- **Mitigation**:
  - Prisma connection pool configured to match capacity
  - Postfix/Dovecot use separate connection pools with limits
  - PgBouncer for connection pooling if needed
  - `max_connections` set appropriately (default 100 → increase if needed)
  - Connection pool metrics exposed
- **Detection**: PostgreSQL connection count metrics; Prisma pool exhaustion logs.
- **Residual Risk**: Low.

### 3.3 Redis Memory Limits

- **Description**: Redis exceeds available memory, causing evictions or OOM kills.
- **Impact**: 🟡 **Medium** — Cache misses, job queue failures.
- **Likelihood**: Medium — Rspamd bayes data can grow.
- **Mitigation**:
  - `maxmemory 256mb` with `allkeys-lru` eviction policy
  - Separate Redis instances for cache vs. queue if needed
  - Cache TTLs on all cached data
  - Redis memory metrics monitoring
- **Detection**: Redis `used_memory` metrics; OOM kill alerts.
- **Residual Risk**: Low.

### 3.4 Docker Volume Data Loss

- **Description**: Named volumes or bind mounts are accidentally deleted or corrupted.
- **Impact**: 🔴 **High** — Complete mail and database loss.
- **Likelihood**: Low — Requires explicit destructive action.
- **Mitigation**:
  - Named volumes with explicit declarations in docker-compose
  - Automated backup scripts (Maildir rsync + pg_dump)
  - Backup verification (test restores)
  - `docker compose down` without `-v` by default
  - Documentation: never use `docker system prune` without checking volumes
- **Detection**: Backup verification; volume existence checks in health checks.
- **Residual Risk**: Very Low.

### 3.5 Certificate Expiry

- **Description**: TLS certificates expire, causing connection failures.
- **Impact**: 🟡 **Medium** — SMTP/IMAP/HTTPS failures until renewed.
- **Likelihood**: Medium — 90-day Let's Encrypt certs need regular renewal.
- **Mitigation**:
  - Certbot with auto-renewal timer
  - Post-renewal hooks to reload Postfix and Dovecot
  - Certificate expiry monitoring (alert at 14 days)
  - Fallback: manual renewal procedure documented
- **Detection**: Certificate expiry Prometheus metric; external SSL monitoring.
- **Residual Risk**: Low.

### 3.6 Service Interdependency Failures

- **Description**: One service crash cascades to others (e.g., Redis down breaks BullMQ, cache, and Rspamd).
- **Impact**: 🟡 **Medium** — Partial or full outage.
- **Likelihood**: Medium — Complex multi-service system.
- **Mitigation**:
  - `restart: unless-stopped` on all containers
  - Health checks with `healthcheck:` in docker-compose
  - `depends_on` with `condition: service_healthy`
  - Graceful degradation: mail delivery continues even if API is down
  - Circuit breakers in NestJS for IMAP connections
- **Detection**: Container health metrics; Prometheus alerts on restart counts.
- **Residual Risk**: Low.

---

## 4. Performance Risks

### 4.1 Large Mailbox Performance

- **Description**: Mailboxes with 10k+ messages cause slow IMAP operations.
- **Impact**: 🟡 **Medium** — Poor user experience, API timeouts.
- **Likelihood**: Medium — Power users accumulate large mailboxes.
- **Mitigation**:
  - Server-side IMAP SORT and SEARCH (never fetch all messages)
  - Pagination: 50 messages per page
  - Redis caching of folder metadata and message list pages
  - Dovecot optimized indexes (`mail_cache_fields`)
  - Maildir with Dovecot's `maildir_very_dirty_syncs = yes` for performance
  - Target: inbox loads in < 1s for 10k messages
- **Detection**: API response time metrics; Dovecot performance logs.
- **Residual Risk**: Low.

### 4.2 IMAP Connection Pooling

- **Description**: Each user session opens an IMAP connection; many concurrent users exhaust Dovecot connections.
- **Impact**: 🟡 **Medium** — Connection refused errors, degraded performance.
- **Likelihood**: Medium — Depends on concurrent user count.
- **Mitigation**:
  - `imapflow` connection pooling per user session
  - Connection timeout and idle cleanup
  - Dovecot `mail_max_userip_connections = 20`
  - Reuse IDLE connections for notifications
  - Connection metrics for capacity planning
- **Detection**: Dovecot connection count metrics; IMAP error rate monitoring.
- **Residual Risk**: Low.

### 4.3 Concurrent User Scaling

- **Description**: System can't handle target concurrent user count.
- **Impact**: 🟡 **Medium** — Degraded performance for all users.
- **Likelihood**: Low — Self-hosted typically has fewer users.
- **Mitigation**:
  - Horizontal scaling plan (documented but not implemented initially)
  - NestJS clustering with PM2 or Node cluster
  - Redis for shared state (stateless API)
  - Load testing with k6 as part of Phase 6
  - Target: 100 concurrent users on a single server
- **Detection**: Load test results; response time metrics.
- **Residual Risk**: Low.

### 4.4 Attachment Handling

- **Description**: Large attachments cause memory spikes, slow uploads, or timeouts.
- **Impact**: 🟢 **Low** — Single-user impact, recoverable.
- **Likelihood**: Medium — Users send large files.
- **Mitigation**:
  - `message_size_limit = 25MB` in Postfix
  - Streaming upload/download (no full-body buffering)
  - Multer with file size limits in NestJS
  - Upload progress bar in UI
  - Proper `Content-Disposition` headers for downloads
- **Detection**: Upload/download error rates; memory usage spikes.
- **Residual Risk**: Low.

---

## 5. Compliance Risks

### 5.1 Data Privacy (GDPR)

- **Description**: Email data contains personal information subject to privacy regulations.
- **Impact**: 🟡 **Medium** — Legal liability, fines.
- **Likelihood**: Medium — Depends on deployment jurisdiction and users.
- **Mitigation**:
  - Data stored locally (self-hosted, no third-party data sharing)
  - Mailbox deletion purges all associated data
  - Audit logging for data access
  - Document data handling practices
  - Support for data export (mailbox export as mbox)
  - Encryption at rest recommended (filesystem-level)
- **Detection**: Audit log review; compliance checklist.
- **Residual Risk**: Medium — operator responsibility, not fully automatable.

### 5.2 Email Retention Policies

- **Description**: Missing retention policies lead to either over-retention or premature deletion.
- **Impact**: 🟡 **Medium** — Legal/compliance issues.
- **Likelihood**: Low — Self-hosted, operator sets policies.
- **Mitigation**:
  - Configurable retention per domain
  - Trash auto-purge (30 days default)
  - Spam auto-purge (30 days)
  - Document recommended retention policies
- **Detection**: Retention policy compliance reports.
- **Residual Risk**: Low.

### 5.3 Audit Logging Gaps

- **Description**: Important actions are not logged, making forensic investigation impossible.
- **Impact**: 🟢 **Low** — Difficulty investigating incidents.
- **Likelihood**: Medium — Easy to miss logging some actions.
- **Mitigation**:
  - Comprehensive `AuditLog` model in Prisma
  - Interceptor-based logging in NestJS for all admin actions
  - Postfix and Dovecot mail transaction logs
  - Log retention: 90 days minimum
  - Structured JSON logs for searchability
- **Detection**: Regular audit log review; gap analysis during security reviews.
- **Residual Risk**: Low.

---

## Risk Acceptance Notes

1. **Inbound SMTP TLS**: Cannot require TLS on port 25 (would break legitimate mail delivery). This is an accepted industry-wide limitation mitigated by MTA-STS.
2. **IP Reputation**: New deployments will face initial deliverability challenges. This is unavoidable and mitigated by warmup procedures and documentation.
3. **GDPR Compliance**: Ultimately the operator's responsibility. We provide tools and documentation but cannot guarantee compliance for all jurisdictions.
