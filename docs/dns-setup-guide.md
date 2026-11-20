# MailHive DNS & Deliverability Setup Guide 📡

This guide provides step-by-step instructions for properly configuring DNS records for your domains hosted on MailHive to achieve 10/10 mail deliverability scores and avoid spam filters (Google Gmail, Microsoft Outlook, Apple Mail).

---

## 📋 Required DNS Records Checklist

For any hosted domain (e.g. `yourdomain.com`) served by mail server hostname `mail.yourdomain.com` with server public IP `203.0.113.10`:

| Record Type | Host / Name | Value / Target | Priority / TTL | Purpose |
|-------------|-------------|----------------|----------------|---------|
| **A** | `mail.yourdomain.com` | `203.0.113.10` | 3600 | Hostname resolution for SMTP & IMAP |
| **MX** | `@` (or `yourdomain.com`) | `mail.yourdomain.com.` | 10 | Directs inbound emails to MailHive Postfix |
| **TXT (SPF)** | `@` (or `yourdomain.com`) | `v=spf1 mx ~all` (or `v=spf1 ip4:203.0.113.10 ~all`) | 3600 | Authorizes your server IP to send mail |
| **TXT (DKIM)**| `mailhive._domainkey` | `v=DKIM1; k=rsa; p=<PUBLIC_KEY>` | 3600 | Cryptographic signature verification |
| **TXT (DMARC)**| `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100` | 3600 | DMARC policy enforcement and reporting |
| **PTR (rDNS)**| `203.0.113.10` (ISP/Host) | `mail.yourdomain.com.` | Managed by VPS | Reverse DNS validation (mandatory for Gmail/Yahoo) |
| **TXT (MTA-STS)**| `_mta-sts` | `v=STSv1; id=20261120T120000Z` | 86400 | Enforces TLS connection security |

---

## 🔑 1. DKIM (DomainKeys Identified Mail)

MailHive automatically generates a 2048-bit RSA key pair for each domain added through the Admin Console (`/admin/domains`).

1. Log into MailHive Admin at `http://your-server:3000/admin`.
2. Navigate to **Domains** and click **DNS Setup** on your domain.
3. Copy the **DKIM Public Key** record.
4. Add a `TXT` record at your DNS provider:
   - **Name / Host:** `mailhive._domainkey` (or `mailhive._domainkey.yourdomain.com`)
   - **Type:** `TXT`
   - **Value:** `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...`

> [!TIP]
> Some DNS providers (like Cloudflare or GoDaddy) limit TXT records to 255 characters per string. If your DNS provider does not split long strings automatically, split the string into multiple quoted segments `("v=DKIM1;..." "p=...")`.

---

## 🛡 2. SPF (Sender Policy Framework)

An SPF record specifies which IP addresses or MX hosts are permitted to send emails on behalf of your domain.

- **Recommended Record:**
  - **Host:** `@`
  - **Type:** `TXT`
  - **Value:** `v=spf1 mx ip4:203.0.113.10 ~all`
- **Explanation:**
  - `v=spf1`: SPF version 1.
  - `mx`: All hosts listed in the domain's MX records are authorized.
  - `ip4:203.0.113.10`: Explicitly authorizes your mail server IP.
  - `~all`: SoftFail for any other sender (recommended during initial warm-up). Switch to `-all` (HardFail) once fully verified.

---

## 🔒 3. DMARC (Domain-based Message Authentication, Reporting & Conformance)

DMARC tells receiving mail servers what to do when an email fails SPF or DKIM checks.

- **Recommended Phase 1 (Monitoring):**
  - **Host:** `_dmarc`
  - **Type:** `TXT`
  - **Value:** `v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com; sp=none; aspf=r; adkim=r`
- **Recommended Phase 2 (Enforcement):**
  - **Host:** `_dmarc`
  - **Type:** `TXT`
  - **Value:** `v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com; pct=100; adkim=s; aspf=s`

---

## 🔄 4. Reverse DNS (rDNS / PTR Record)

Most major mail providers (Gmail, Outlook, Yahoo) **reject connection attempts immediately** if the sending IP does not have a matching PTR record that resolves back to the `EHLO` hostname.

1. Go to your VPS or cloud provider control panel (Hetzner, DigitalOcean, AWS, Linode, OVH).
2. Find the IP management section for your instance.
3. Edit the **Reverse DNS (PTR)** of your IPv4 (and IPv6 if enabled).
4. Set the value exactly to your `MAIL_HOSTNAME`:
   ```
   203.0.113.10  ──►  mail.yourdomain.com
   ```
5. Verify using dig:
   ```bash
   dig -x 203.0.113.10 +short
   # Output must be: mail.yourdomain.com.
   ```

---

## 🌐 Provider-Specific Instructions

### Cloudflare
1. Go to Cloudflare Dashboard → **DNS** → **Records**.
2. Add `A` record for `mail` pointing to your IP. **Ensure Proxy Status is DNS Only (Grey Cloud)**. Proxied mail traffic (Orange Cloud) will break SMTP and IMAP connections.
3. Add `MX` record pointing to `mail.yourdomain.com`.
4. Add `TXT` record for SPF (`@`) and DKIM (`mailhive._domainkey`).

### AWS Route 53
1. Hosted Zones → Select domain → **Create record**.
2. Type `MX`, enter Priority and FQDN.
3. Type `TXT`, paste DKIM key enclosed in double quotes `"v=DKIM1; k=rsa; p=..."`.

---

## 🔍 Deliverability Verification Tools

After publishing your DNS records, verify your deliverability score using:
1. **Mail-Tester:** Send a test email from MailHive webmail to `test-xxxx@mail-tester.com` to get a 10/10 deliverability report.
2. **MXToolbox SuperTool:** `https://mxtoolbox.com/SuperTool.aspx` to test MX, SPF, DKIM, and SMTP Banner.
3. **Google Postmaster Tools:** Register your domain at `https://postmaster.google.com` to monitor sender reputation and spam rate.
