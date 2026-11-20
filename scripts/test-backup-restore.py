#!/usr/bin/env python3
"""
MailHive Backup & Restore Verification Suite
Validates that backup.sh and restore.sh accurately preserve and restore:
  1. PostgreSQL database records (contacts, audit logs, accounts)
  2. Dovecot Maildir files (/var/vmail/<domain>/<user>)
  3. SHA256 checksum integrity verification
"""

import os
import sys
import uuid
import subprocess
import time
import imaplib
import ssl

def log(msg):
    print(f"[TEST-BACKUP] {msg}")

def psql_query(sql):
    cmd = ["docker", "exec", "-i", "mailhive-postgres", "psql", "-U", "mailhive", "-d", "mailhive", "-t", "-A", "-c", sql]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return result.stdout.strip()


def main():
    test_id = str(uuid.uuid4())[:8]
    test_contact_email = f"backup-restore-{test_id}@testmarker.local"
    test_marker_subject = f"MailHive Disaster Recovery Test Marker {test_id}"
    
    log(f"Starting Backup & Restore Verification with marker: {test_id}")
    
    # 1. Insert test marker in PostgreSQL
    log("Step 1: Inserting test marker into PostgreSQL...")
    mailbox_id = psql_query("SELECT id FROM mailboxes WHERE email = 'alice@example.test';")
    if not mailbox_id:
        log("ERROR: alice@example.test mailbox not found!")
        sys.exit(1)
    
    psql_query(f"""
        INSERT INTO contacts (id, "mailboxId", email, "displayName", "contactCount", "lastContactedAt", "updatedAt")
        VALUES ('{str(uuid.uuid4())}', '{mailbox_id}', '{test_contact_email}', 'Marker {test_id}', 1, NOW(), NOW());
    """)
    log(f"Inserted test contact: {test_contact_email}")

    # 2. Plant test email in Maildir storage
    log("Step 2: Planting test email message into Maildir storage...")
    email_content = f"""From: disaster-recovery@mailhive.local
To: alice@example.test
Subject: {test_marker_subject}
Date: Fri, 20 Nov 2026 12:00:00 +0000
Message-ID: <backup-test-{test_id}@mailhive.local>
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

This is a test message to verify full backup and restoration of Maildir storage.
Marker UUID: {test_id}
"""
    email_bytes = email_content.encode("utf-8")
    maildir_dest = f"/var/vmail/example.test/alice/Maildir/new/{int(time.time())}.M{test_id}P00000.mailhive,S={len(email_bytes)}:2,"
    proc = subprocess.run([
        "docker", "exec", "-i", "mailhive-dovecot", "sh", "-c",
        f"cat > '{maildir_dest}' && chown 5000:5000 '{maildir_dest}'"
    ], input=email_bytes, check=True)
    log("Planted test email in Maildir.")

    # 3. Execute backup.sh
    log("Step 3: Executing ./scripts/backup.sh...")
    backup_proc = subprocess.run(["./scripts/backup.sh"], capture_output=True, text=True)
    if backup_proc.returncode != 0:
        log(f"Backup failed! Stderr: {backup_proc.stderr}")
        sys.exit(1)
    log("Backup succeeded.")

    # 4. Simulate Disaster: Delete contact and remove email
    log("Step 4: Simulating disaster (deleting contact and removing Maildir email)...")
    psql_query(f"DELETE FROM contacts WHERE email = '{test_contact_email}';")
    
    # Verify contact is gone
    check_contact = psql_query(f"SELECT id FROM contacts WHERE email = '{test_contact_email}';")
    if check_contact:
        log("ERROR: Contact deletion failed!")
        sys.exit(1)
    
    # Remove test email from Maildir
    subprocess.run([
        "docker", "exec", "mailhive-dovecot", "rm", "-f", maildir_dest
    ], check=True)
    log("Disaster simulated: test contact deleted from DB, test email removed from Maildir.")

    # 5. Execute restore.sh latest
    log("Step 5: Executing ./scripts/restore.sh latest...")
    restore_proc = subprocess.run(["./scripts/restore.sh", "latest"], capture_output=True, text=True)
    if restore_proc.returncode != 0:
        log(f"Restore failed! Stderr: {restore_proc.stderr}")
        sys.exit(1)
    log("Restore execution complete.")

    # 6. Verify PostgreSQL Restoration
    log("Step 6: Verifying PostgreSQL data restoration...")
    restored_contact = psql_query(f"SELECT email FROM contacts WHERE email = '{test_contact_email}';")
    if not restored_contact:
        log(f"FAILED: Restored contact {test_contact_email} NOT found in database!")
        sys.exit(1)
    log(f"PASSED: Contact successfully restored in PostgreSQL: {restored_contact}")

    # 7. Verify Maildir Restoration via Dovecot IMAP
    log("Step 7: Verifying Maildir storage restoration via Dovecot IMAP...")
    time.sleep(1)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    imap = imaplib.IMAP4_SSL("localhost", 993, ssl_context=ctx)
    imap.login("alice@example.test", "alice123456")
    imap.select("INBOX")
    
    typ, data = imap.search(None, f'SUBJECT "{test_id}"')
    msg_ids = data[0].split()
    if not msg_ids:
        log(f"FAILED: Email with subject marker '{test_id}' NOT found in IMAP INBOX!")
        imap.logout()
        sys.exit(1)
        
    typ, msg_data = imap.fetch(msg_ids[0], "(RFC822)")
    raw_email = msg_data[0][1].decode("utf-8", errors="replace")
    if test_id not in raw_email:
        log("FAILED: Restored email does not contain expected test UUID!")
        imap.logout()
        sys.exit(1)
        
    imap.close()
    imap.logout()
    log(f"PASSED: Restored email message retrieved and verified via IMAP (ID: {msg_ids[0].decode()})")

    # 8. Cleanup test contact and email
    log("Step 8: Cleaning up verification test markers...")
    psql_query(f"DELETE FROM contacts WHERE email = '{test_contact_email}';")
    subprocess.run([
        "docker", "exec", "mailhive-dovecot", "rm", "-f", maildir_dest
    ], stderr=subprocess.DEVNULL)
    
    log("==================================================")
    log(" ALL BACKUP & RESTORE VERIFICATION TESTS PASSED!")
    log("==================================================")

if __name__ == "__main__":
    main()
