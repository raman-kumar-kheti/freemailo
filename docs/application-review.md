# Application revision — phases 0–7

Reviewed 2026-11-20–21. The existing application was revised in place. The local regression checks listed below pass; this is **not a claim that every feature in the original brief is complete or that a public deployment is certified production-ready**. Remaining product and deployment work is explicit below.

## Inbox incident and repair

The original inbox failure was reproduced: folder listing worked, but loading messages returned HTTP 500. Three imported Alice messages declared `S=500` in their Maildir filenames while containing only 369 bytes. Dovecot disconnected FETCH; an exception during LOGOUT then hid that failure.

The mailbox was backed up before repair. Dovecot now uses `maildir_broken_filename_sizes = yes`, the affected INBOX was resynced, and connection cleanup preserves the original error. Authenticated list and detail requests returned HTTP 200 afterward; subsequent verification used real SMTP delivery and IMAP APPEND. Never fabricate Maildir size suffixes. See [Dovecot's Maildir guidance](https://doc.dovecot.org/2.3/configuration_manual/mail_location/Maildir/).

## Phase-by-phase findings and changes

| Phase | Revision | Evidence / boundary |
| --- | --- | --- |
| 0 — architecture and contracts | Reconciled the diagrams, data flow, deployment boundaries and risks with actual code; exported OpenAPI for 42 route paths. Removed obsolete Roundcube and unsupported security claims from current architecture docs. | [Architecture](architecture.md), [API snapshot](api-specification.yaml), [risks](risks.md). Some response DTOs remain under-annotated in Swagger. |
| 1 — mail core | Fixed Maildir FETCH failure; enforced submission TLS and envelope sender ownership; disabled inbound AUTH; persisted the queue; repaired shared DKIM directory permissions. Fixed Sieve delivery order, missing spam-learning executables and vacation SMTP transport. | Real SMTP/IMAP delivery, generated DKIM key and signed delivered MIME, relay denial, forged-header replacement, GTUBE rejection, Junk training and an actual delivered vacation reply. Public DNS/DKIM verification still requires a real domain. |
| 2 — backend | Dovecot verifies mailbox credentials; disabled/deleted account/domain checks apply; refresh rotation is atomic. Removed Docker-socket provisioning, made shared-volume jobs idempotent, added reconciliation and usable failed-job retries. Redacted credentials and private keys. | Provisioning script creates a working mailbox; a previously failed DKIM job completed after permission repair and retry; refresh-race regression produces one success and one rejection. |
| 3 — mail API | Corrected global UID sorting/pagination, search validation, attachment detection/download, safe draft replacement/MIME, bounded realtime lifecycle and send validation. Awaited Sent persistence and separated its failure from SMTP acceptance. | Twelve phase-3 integration flows plus malformed-input, MIME-byte, ManageSieve, session and CSRF regressions. Performance evidence below. |
| 4 — webmail | Retained the redesigned UI; corrected cookie session handling, reconnect behavior, real settings and API contracts. Reading/compose, folder operations, drafts, recipient handling and accessibility are covered. | 16 browser tests pass: eight fixture-backed interaction tests and eight checks against the live stack. The earlier populated-fixture Lighthouse accessibility score is 100. Feature gaps remain below. |
| 5 — administration | Corrected mailbox/alias DTOs, ownership, pagination totals, jobs/retry/audit rendering, health and exact DNS comparisons. Replaced the hardcoded 12 MB usage indicator with bounded reads of actual Dovecot quota counters. | Live admin browser flow passes; API returns real nonzero mailbox usage. Missing/corrupt counters report unavailable. |
| 6 — hardening and operations | Updated dependencies/runtime images, pinned ImapFlow's protocol-adapter version, hardened cookies/CSRF/TLS, added genuine HTTP metrics and Rspamd health checks. Protected authentication badges, added relay/learning/rejection tests and full CI checks with release-tag image publishing. | 37 unit tests, clean lint/typecheck, application image builds, zero API/web npm audit findings, real mail regressions and format-3 isolated restore pass. CI workflow is configured but has not been run on GitHub or published images in this review. |
| 7 — documentation and release | Updated README, environment reference, architecture, recovery/deployment, troubleshooting, API snapshot and risk review. Certificate setup preserves existing material; Postfix fails clearly when required TLS files are missing. | Reproducible commands below, [machine-readable results](verification-results.json), and [deployment release gates](deployment-runbook.md#release-gates). |

## Commands and observed results

Run the integration commands only against the private development stack: they create test mail and accounts.

| Command | Result |
| --- | --- |
| `npm run lint` and `npm run typecheck` | API and web passed, no lint warnings. |
| `npm test` | 37 tests in nine suites passed. Includes environment, CSRF, validation, IMAP sorting, MIME, quota and authentication-result regressions. |
| `docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml build` | All five application/mail images built; subsequent changed API/Rspamd/Postfix images rebuilt and started successfully. API/web use non-root runtime users. |
| `python3 scripts/test-phase2.py` | New domain/key and mailbox verified through SMTP, IMAP and webmail login; delivered MIME contains the provisioned domain DKIM signature. Repeated after backup maintenance. |
| `python3 scripts/test-phase3.py` | Twelve API flows passed, including send/receive, drafts, flags, moves, search and SSE startup; repeated after maintenance. |
| `python3 scripts/test-revision.py` | Cookie auth/CSRF, malformed inputs, out-of-range pagination, exact attachment bytes, Sent persistence, ManageSieve, refresh concurrency and logout passed. |
| `python3 scripts/test-open-relay.py` | No inbound AUTH; unauthenticated external recipient explicitly rejected as relay. Null reverse path avoids mistaking sender-DNS rejection for relay protection. |
| `python3 scripts/test-smtp-policy.py` | AUTH requires TLS; sender ownership enforced; internal relay denied without a client certificate and accepts the pinned certificate. External RCPT probes are reset without DATA or delivery. |
| `python3 scripts/test-authentication-headers.py` | Forged Authentication-Results removed on ports 25 and 587; API badges use trusted results or report none. |
| `python3 scripts/test-vacation.py` | Provisioned a temporary mailbox, activated ManageSieve, delivered incoming mail and received its automatic reply at Bob; temporary mailbox archived afterward. |
| `python3 scripts/test-spam-learning.py` | Real IMAP moves into and out of Junk increased Rspamd learning transactions; daemon logs confirmed spam/ham learning. |
| `python3 scripts/test-spam-rejection.py` | Harmless GTUBE rejected at SMTP DATA before queuing. |
| `cd apps/web && npx playwright test --workers=1` | 16 passed in 37.7 seconds on the rebuilt app. Live login/webmail Axe checks reported no critical/serious violations; email iframe excluded. |
| `npm --prefix apps/api audit` and `npm --prefix apps/web audit` | Both report zero findings as of 2026-11-21. This does not cover OS packages or future advisories. |
| `node scripts/test-mail-load.cjs` | 2026-11-20 run: 10,000 messages, 20 list requests, p95 108 ms, maximum 645 ms, IDLE notification 517 ms. Isolated mailbox archived afterward. Single-host development result, not concurrent-tenant capacity. |
| `./scripts/backup.sh /tmp/mailhive-release-backup` | Format-3 snapshot `20261121_150541`; all five archive/database checksums passed. Writers restarted afterward. |
| `./scripts/test-restore-isolated.sh /tmp/mailhive-release-backup` | Restored 12 mailbox records into disposable PostgreSQL and verified Maildir, Rspamd/DKIM, queue and Redis archive bytes. Live volumes untouched. |
| `docker compose ... up -d --wait` and `GET /api/health` | All seven services healthy after maintenance; PostgreSQL, Redis, SMTP, IMAP and Rspamd checks up. HTTP metrics populated. |

The retained [Lighthouse summary](ui-review/lighthouse-summary.json) and [report](ui-review/lighthouse.html) are from 2026-11-20 with test-only populated mailbox fixtures. They are not a new live-backend Lighthouse run or a full WCAG certification. Tests are evidence of their stated coverage, not proof of absence of all defects.

Authentication-header handling follows [Rspamd's replacement and local/authenticated-header controls](https://docs.rspamd.com/modules/milter_headers/). Historical/imported messages are not retroactively authenticated. Postfix's `ORIGINATING` submission result describes SASL authentication, so the UI does not invent recipient-side SPF/DKIM/DMARC passes from it.

## Remaining work against the original brief

These are still gaps, despite earlier “all phases complete” labels:

- Conversation retrieval exists in the API, but the UI does not provide grouped, collapsible conversations or expand-all.
- The UI's search, Starred and label views currently search INBOX. There is no cross-folder All Mail aggregation; the sidebar exposes Archive instead. A global implementation must carry folder identity alongside UIDs for every read and mutation.
- Draft bodies/recipients persist, but draft attachments stay in memory. Compose keeps the window open/minimized and warns on departure; reopening the draft cannot recover its attachments. Forwarding does not automatically copy the original attachments.
- Message-list snippets and a Redis cache for message-list metadata are not implemented; folder metadata is cached. Large-mailbox performance was measured without claiming those features exist.
- The API still has explicit/implicit `any` usage and does not enable every strict TypeScript option. Swagger response schemas need stronger annotations. Passing typecheck is not equivalent to a fully strict contract.

Public release also requires real DNS/PTR and trusted certificates, independent-provider send/receive checks, host/proxy controls, daemon brute-force protection, outbound abuse controls, encrypted off-host backups, monitoring/alerting and a recovery rehearsal on a separate host. CI must run successfully on the repository and registry permissions must be validated before tagging a release. See the [runbook](deployment-runbook.md) and [risk review](risks.md). No production deployment or external test email was performed.
