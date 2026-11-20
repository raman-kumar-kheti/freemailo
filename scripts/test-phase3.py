#!/usr/bin/env python3
"""
MailHive Phase 3 Acceptance Verification Script.
Tests all Mail API endpoints, IMAP operations, outbound SMTP, drafts, flags, search, settings, and SSE.
"""

import sys
import time
import requests
import json
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

API_BASE = "http://localhost:4000/api"

def print_step(title):
    print(f"\n--- {title} ---")

def main():
    run_id = int(time.time())
    print("==================================================================")
    print("                PHASE 3 - MAIL API ACCEPTANCE TESTS               ")
    print("==================================================================")

    session_alice = requests.Session()
    session_bob = requests.Session()

    # 1. Login Alice
    print_step("Test 1: Mailbox Authentication (POST /api/auth/login)")
    res = session_alice.post(f"{API_BASE}/auth/login", json={
        "email": "alice@example.test",
        "password": "alice123456"
    })
    if res.status_code != 200:
        print(f"❌ Alice login failed: {res.status_code} {res.text}")
        sys.exit(1)
    alice_token = res.json()["accessToken"]
    headers_alice = {"Authorization": f"Bearer {alice_token}"}
    print(f"✅ Alice authenticated. Mailbox: {res.json()['user']['email']}")

    # Login Bob
    res = session_bob.post(f"{API_BASE}/auth/login", json={
        "email": "bob@example.test",
        "password": "bob123456"
    })
    if res.status_code != 200:
        print(f"❌ Bob login failed: {res.status_code} {res.text}")
        sys.exit(1)
    bob_token = res.json()["accessToken"]
    headers_bob = {"Authorization": f"Bearer {bob_token}"}
    print(f"✅ Bob authenticated. Mailbox: {res.json()['user']['email']}")

    # 2. List Folders
    print_step("Test 2: List Folders (GET /api/mail/folders)")
    res = session_alice.get(f"{API_BASE}/mail/folders", headers=headers_alice)
    if res.status_code != 200:
        print(f"❌ List folders failed: {res.status_code} {res.text}")
        sys.exit(1)
    folders = res.json()["folders"]
    folder_names = [f["name"] for f in folders]
    print(f"✅ Folders retrieved ({len(folders)} folders): {folder_names}")
    assert any(f["name"].upper() == "INBOX" for f in folders), "INBOX folder missing"

    # 3. Create a Signature and Send Email (Alice -> Bob)
    print_step("Test 3: Outbound SMTP Delivery with Signature (POST /api/mail/send)")
    # Create signature
    res = session_alice.post(f"{API_BASE}/settings/signatures", headers=headers_alice, json={
        "name": "Work Signature",
        "body": "<p>Best regards,<br>Alice Wonder</p>",
        "isDefault": True
    })
    sig_id = res.json()["id"] if res.status_code == 201 else None

    # Send mail via API
    test_subject = f"Phase 3 Mail API Test - {int(time.time())}"
    send_payload = {
        "to": ["bob@example.test"],
        "subject": test_subject,
        "htmlBody": "<p>Hello Bob, this is a test from the Phase 3 NestJS Mail API with <b>HTML</b> formatting!</p>",
        "textBody": "Hello Bob, this is a test from the Phase 3 NestJS Mail API!",
        "signatureId": sig_id
    }
    res = session_alice.post(f"{API_BASE}/mail/send", headers=headers_alice, json=send_payload)
    if res.status_code != 200 and res.status_code != 201:
        print(f"❌ Send mail failed: {res.status_code} {res.text}")
        sys.exit(1)
    send_res = res.json()
    print(f"✅ Email sent successfully! Message-ID: {send_res.get('messageId')}")

    # Wait 2 seconds for LMTP local delivery
    time.sleep(2)

    # 4. Bob receives the email in INBOX
    print_step("Test 4: Bob checks INBOX for received message (GET /api/mail/messages)")
    res = session_bob.get(f"{API_BASE}/mail/messages?folder=INBOX", headers=headers_bob)
    if res.status_code != 200:
        print(f"❌ Bob list messages failed: {res.status_code} {res.text}")
        sys.exit(1)
    messages = res.json()["data"]
    target_msg = next((m for m in messages if m["subject"] == test_subject), None)
    if not target_msg:
        print(f"❌ Sent message '{test_subject}' not found in Bob's INBOX. Total messages: {len(messages)}")
        sys.exit(1)
    bob_msg_uid = target_msg["uid"]
    print(f"✅ Found message in Bob's INBOX! UID: {bob_msg_uid}, Subject: '{target_msg['subject']}', From: {target_msg['from']['address']}")

    # 5. Read full message & verify DOMPurified HTML and AuthResults
    print_step(f"Test 5: Get Full Message Details (GET /api/mail/messages/{bob_msg_uid})")
    res = session_bob.get(f"{API_BASE}/mail/messages/{bob_msg_uid}?folder=INBOX", headers=headers_bob)
    if res.status_code != 200:
        print(f"❌ Get message details failed: {res.status_code} {res.text}")
        sys.exit(1)
    msg_detail = res.json()
    print(f"✅ Full message retrieved!")
    print(f"   Subject: {msg_detail['subject']}")
    print(f"   HTML Body (Sanitized): {msg_detail['htmlBody'][:80]}...")
    print(f"   Auth Results: SPF={msg_detail['authResults']['spf']}, DKIM={msg_detail['authResults']['dkim']}, DMARC={msg_detail['authResults']['dmarc']}")
    assert "Alice Wonder" in msg_detail["htmlBody"], "Signature was not included in HTML body"

    # 6. Raw Message Source (RFC 5322)
    print_step(f"Test 6: Get Raw RFC 5322 Message Source (GET /api/mail/messages/{bob_msg_uid}/raw)")
    res = session_bob.get(f"{API_BASE}/mail/messages/{bob_msg_uid}/raw?folder=INBOX", headers=headers_bob)
    if res.status_code != 200:
        print(f"❌ Get raw message failed: {res.status_code} {res.text}")
        sys.exit(1)
    raw_source = res.text
    print(f"✅ Raw source retrieved ({len(raw_source)} bytes). Contains 'DKIM-Signature': {'DKIM-Signature' in raw_source or 'dkim' in raw_source.lower()}")

    # 7. Update Flags (Star and Mark Read/Unread)
    print_step(f"Test 7: Update Message Flags (PATCH /api/mail/messages/flags)")
    res = session_bob.patch(f"{API_BASE}/mail/messages/flags", headers=headers_bob, json={
        "folder": "INBOX",
        "uids": [bob_msg_uid],
        "flags": ["\\Flagged"],
        "action": "add"
    })
    if res.status_code != 204:
        print(f"❌ Star message failed: {res.status_code} {res.text}")
        sys.exit(1)
    print(f"✅ Message starred (flag \\Flagged added)")

    # Verify starred
    res = session_bob.get(f"{API_BASE}/mail/messages/{bob_msg_uid}?folder=INBOX", headers=headers_bob)
    assert res.json()["isStarred"] is True, "Message isStarred should be true"
    print(f"✅ Verified flag persisted in Dovecot IMAP: isStarred = True")

    # 8. Draft Management (Create & Update)
    print_step("Test 8: Draft Management (POST /api/mail/draft & PUT /api/mail/draft/:uid)")
    res = session_alice.post(f"{API_BASE}/mail/draft", headers=headers_alice, json={
        "to": ["bob@example.test"],
        "subject": "Unfinished draft proposal",
        "htmlBody": "<p>Initial thoughts...</p>"
    })
    if res.status_code != 201:
        print(f"❌ Create draft failed: {res.status_code} {res.text}")
        sys.exit(1)
    draft_uid = res.json()["uid"]
    print(f"✅ Draft created with UID {draft_uid} in Drafts folder")

    # Update draft
    res = session_alice.put(f"{API_BASE}/mail/draft/{draft_uid}", headers=headers_alice, json={
        "to": ["bob@example.test"],
        "subject": "Updated draft proposal",
        "htmlBody": "<p>Updated draft content ready for review.</p>"
    })
    if res.status_code != 200:
        print(f"❌ Update draft failed: {res.status_code} {res.text}")
        sys.exit(1)
    print(f"✅ Draft updated successfully")

    # 9. Search with Operators
    print_step("Test 9: Search with operators (GET /api/mail/search?q=...)")
    res = session_bob.get(f"{API_BASE}/mail/search?q=from:alice@example.test is:starred&folder=INBOX", headers=headers_bob)
    if res.status_code != 200:
        print(f"❌ Search failed: {res.status_code} {res.text}")
        sys.exit(1)
    search_results = res.json()["data"]
    print(f"✅ Search with query 'from:alice@example.test is:starred' returned {len(search_results)} message(s)")
    assert len(search_results) > 0, "Expected at least 1 search result"

    # 10. Settings & Contacts Autocomplete
    print_step("Test 10: Settings (Profile, Labels, Trusted Senders, Contacts Autocomplete)")
    # Profile update
    res = session_alice.put(f"{API_BASE}/settings/profile", headers=headers_alice, json={
        "displayName": "Alice Wonderland"
    })
    assert res.status_code == 200, "Profile update failed"
    print(f"✅ Profile updated: displayName = '{res.json()['displayName']}'")

    # Labels CRUD
    res = session_alice.post(f"{API_BASE}/settings/labels", headers=headers_alice, json={
        "name": f"Projects {run_id}",
        "color": "#10b981"
    })
    assert res.status_code == 201, "Create label failed"
    label_id = res.json()["id"]
    print(f"✅ Custom label created: ID {label_id}, Name '{res.json()['name']}'")

    # Trusted Senders
    res = session_alice.post(f"{API_BASE}/settings/trusted-senders", headers=headers_alice, json={
        "email": f"newsletter-{run_id}@partner.test"
    })
    assert res.status_code == 201, "Add trusted sender failed"
    print(f"✅ Trusted sender added for automatic remote images")

    # Contacts Autocomplete (Bob should now be recorded from Alice's sent email)
    res = session_alice.get(f"{API_BASE}/settings/contacts?q=bob", headers=headers_alice)
    assert res.status_code == 200, "Get contacts failed"
    contacts = res.json()["contacts"]
    print(f"✅ Autocomplete contacts returned {len(contacts)} match(es): {[c['email'] for c in contacts]}")

    # 11. Move & Delete Messages
    print_step(f"Test 11: Move Message to Archive and Delete (POST /api/mail/messages/move & DELETE /api/mail/messages)")
    # Move Bob's message to Archive
    res = session_bob.post(f"{API_BASE}/mail/messages/move", headers=headers_bob, json={
        "sourceFolder": "INBOX",
        "destinationFolder": "Archive",
        "uids": [bob_msg_uid]
    })
    if res.status_code != 204:
        print(f"❌ Move message failed: {res.status_code} {res.text}")
        sys.exit(1)
    print(f"✅ Message moved to Archive")

    # Verify message in Archive
    res = session_bob.get(f"{API_BASE}/mail/messages?folder=Archive", headers=headers_bob)
    assert any(m["subject"] == test_subject for m in res.json()["data"]), "Message not found in Archive"
    archive_uid = next(m["uid"] for m in res.json()["data"] if m["subject"] == test_subject)
    print(f"✅ Verified message is in Archive (UID: {archive_uid})")

    # Delete message (moves to Trash)
    res = session_bob.delete(f"{API_BASE}/mail/messages", headers=headers_bob, json={
        "folder": "Archive",
        "uids": [archive_uid]
    })
    if res.status_code != 204:
        print(f"❌ Delete message failed: {res.status_code} {res.text}")
        sys.exit(1)
    print(f"✅ Message deleted from Archive (moved to Trash)")

    # 12. Realtime SSE Connection Check
    print_step("Test 12: Realtime SSE Stream Endpoint (GET /api/mail/events)")
    try:
        sse_res = requests.get(f"{API_BASE}/mail/events", headers=headers_alice, stream=True, timeout=3)
        if sse_res.status_code == 200 and "text/event-stream" in sse_res.headers.get("Content-Type", ""):
            print("✅ SSE stream opened with Content-Type: text/event-stream")
            for line in sse_res.iter_lines(chunk_size=1, decode_unicode=True):
                if line:
                    print(f"   Received SSE initial frame: {line}")
                    break
        else:
            raise AssertionError(f"SSE status {sse_res.status_code}")
    except requests.exceptions.Timeout:
        raise AssertionError("SSE did not produce a frame before timeout")

    print("\n==================================================================")
    print("      🎉 ALL PHASE 3 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!   ")
    print("==================================================================")

if __name__ == "__main__":
    main()
