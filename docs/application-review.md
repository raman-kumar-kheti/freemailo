# Application revision — phases 0–7

Status: in progress. This review revises the existing application; previous completion labels are not acceptance evidence.

## Confirmed inbox incident

Dovecot disconnected FETCH commands because three imported Alice messages declared `S=500` but contained 369 bytes. The API's `finally` LOGOUT then replaced the original failure with “Connection not available”. Before repair the mailbox was archived at `/tmp/mailhive-alice-before-repair.tar.gz`. Applied `maildir_broken_filename_sizes = yes` and resynced INBOX. Actual authenticated API checks then returned 200 for folders, message list (3 messages), and message detail.

The resilience setting is documented by [Dovecot](https://doc.dovecot.org/2.3/configuration_manual/mail_location/Maildir/). All future fixture mail must be delivered via SMTP/IMAP APPEND, never by inventing Maildir size suffixes.

## Review checklist

- Phase 0: reconcile architecture, schema/API contracts and deployment assumptions with implementation.
- Phase 1: validate mail delivery, submission TLS, sender authorization, inactive domains, DKIM, relay protection and storage persistence.
- Phase 2: repair authentication/session handling, real provisioning failures and retries, unsafe shell execution and secret exposure.
- Phase 3: validate send and bulk inputs; fix draft MIME/data loss, pagination, search, attachments, realtime connection lifecycle and error reporting.
- Phase 4: connect redesigned UI to real APIs; verify cookie sessions, admin contracts, user settings and actual mail interactions.
- Phase 5: correct DNS comparisons, domain/mailbox/alias ownership, job visibility and validation.
- Phase 6: dependency audit, reproducible non-root images, health checks, CI, backups and isolated restore verification.
- Phase 7: update runbooks, environment reference, release evidence and explicit external production gates.

## Verification log

- Original live inbox failure reproduced: list returned HTTP 500 while folder list returned 200.
- After Maildir repair: actual inbox list and message detail returned HTTP 200.
- Initial API dependency audit: 25 findings (12 high); initial web audit: 1 critical and 1 high. Remediation in progress.
- Intermediate API build and frontend typecheck passed. Full regression and deployment verification pending.
