import requests
import smtplib
import imaplib
import ssl
import email
import re
from email.mime.text import MIMEText
import time
import sys

BASE_URL = "http://localhost:4000"

def run_phase2_verification():
    print("==================================================================")
    print("                PHASE 2 - BACKEND ACCEPTANCE TESTS                ")
    print("==================================================================")
    session = requests.Session()
    session.headers.update({"X-Requested-With": "MailHive"})

    # -------------------------------------------------------------------------
    # TEST 1: Admin Login
    # -------------------------------------------------------------------------
    print("\n--- Test 1: Admin Authentication (POST /api/auth/admin/login) ---")
    res = session.post(f"{BASE_URL}/api/auth/admin/login", json={
        "email": "admin@mailhive.local",
        "password": "admin123456"
    })
    if res.status_code != 200:
        print(f"❌ Admin login failed: {res.status_code} {res.text}")
        return False
    admin_data = res.json()
    admin_token = admin_data.get("accessToken")
    refresh_cookie = session.cookies.get("refresh_token")
    print(f"✅ Admin logged in. Role: {admin_data['user']['role']}")
    print(f"✅ Refresh cookie set: {'YES' if refresh_cookie else 'NO'}")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # -------------------------------------------------------------------------
    # TEST 2: Mailbox User Login (Alice)
    # -------------------------------------------------------------------------
    print("\n--- Test 2: Mailbox Authentication (POST /api/auth/login) ---")
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "alice@example.test",
        "password": "alice123456"
    })
    if res.status_code != 200:
        print(f"❌ Mailbox login failed: {res.status_code} {res.text}")
        return False
    alice_data = res.json()
    alice_token = alice_data.get("accessToken")
    print(f"✅ Mailbox user Alice logged in. Role: {alice_data['user']['role']}, Domain: {alice_data['user']['domain']}")

    # -------------------------------------------------------------------------
    # TEST 3: Token Refresh & Rotation
    # -------------------------------------------------------------------------
    print("\n--- Test 3: Token Refresh & Rotation (POST /api/auth/refresh) ---")
    res = session.post(f"{BASE_URL}/api/auth/refresh")
    if res.status_code != 200:
        print(f"❌ Token refresh failed: {res.status_code} {res.text}")
        return False
    refreshed_data = res.json()
    new_admin_token = refreshed_data.get("accessToken")
    print("✅ Token rotated successfully.")
    admin_headers = {"Authorization": f"Bearer {new_admin_token}"}

    # -------------------------------------------------------------------------
    # TEST 4: Profile / Me endpoint
    # -------------------------------------------------------------------------
    print("\n--- Test 4: Current User Profile (GET /api/auth/me) ---")
    res = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {alice_token}"})
    if res.status_code != 200:
        print(f"❌ Get profile failed: {res.status_code} {res.text}")
        return False
    print(f"✅ Profile verified for: {res.json()['email']}")

    # -------------------------------------------------------------------------
    # TEST 5: Admin List Domains
    # -------------------------------------------------------------------------
    print("\n--- Test 5: List Domains (GET /api/admin/domains) ---")
    res = requests.get(f"{BASE_URL}/api/admin/domains", headers=admin_headers)
    if res.status_code != 200:
        print(f"❌ List domains failed: {res.status_code} {res.text}")
        return False
    domains_data = res.json()["data"]
    print(f"✅ Found {len(domains_data)} domain(s): {[d['name'] for d in domains_data]}")
    default_domain = next((d for d in domains_data if d["name"] == "example.test"), domains_data[0])

    # -------------------------------------------------------------------------
    # TEST 6: Admin Create Domain & DKIM Generation
    # -------------------------------------------------------------------------
    test_domain_name = f"testdomain-{time.time_ns()}.test"
    print(f"\n--- Test 6: Create Domain & Generate DKIM (POST /api/admin/domains) for {test_domain_name} ---")
    res = requests.post(f"{BASE_URL}/api/admin/domains", headers=admin_headers, json={"name": test_domain_name})
    if res.status_code != 201:
        print(f"❌ Create domain failed: {res.status_code} {res.text}")
        return False
    new_domain = res.json()
    print(f"✅ Domain created: {new_domain['name']} (ID: {new_domain['id']})")
    
    print("Waiting 2 seconds for BullMQ DKIM key generation job...")
    time.sleep(2)
    
    # Check DNS records
    res = requests.get(f"{BASE_URL}/api/admin/domains/{new_domain['id']}/dns", headers=admin_headers)
    dns_records = res.json()["records"]
    for attempt in range(30):
        if dns_records['dkim']['value']: break
        time.sleep(1)
        dns_records = requests.get(f"{BASE_URL}/api/admin/domains/{new_domain['id']}/dns", headers=admin_headers).json()['records']
    assert dns_records['dkim']['value'], 'DKIM provisioning did not complete'
    print('✅ DKIM public key generated and available for DNS')

    # -------------------------------------------------------------------------
    # TEST 7: Create Mailbox via API (Primary Acceptance Check)
    # -------------------------------------------------------------------------
    charlie_local = f"user{int(time.time()) % 10000}"
    charlie_pass = "CharliePassSecure123!"
    charlie_email = f"{charlie_local}@{new_domain['name']}"
    print(f"\n--- Test 7: Provisioning Mailbox via API ({charlie_email}) ---")
    res = requests.post(f"{BASE_URL}/api/admin/mailboxes", headers=admin_headers, json={
        "localPart": charlie_local,
        "domainId": new_domain["id"],
        "password": charlie_pass,
        "displayName": "Charlie Automator",
        "quotaBytes": 1073741824
    })
    if res.status_code != 202:
        print(f"❌ Create mailbox failed: {res.status_code} {res.text}")
        return False
    mailbox_res = res.json()
    job_id = mailbox_res.get("jobId")
    created_mailbox = mailbox_res.get("mailbox")
    print(f"✅ Mailbox created in DB: {created_mailbox['email']}, Provisioning Job ID: {job_id}")

    # Wait for BullMQ worker to process job
    print("Waiting 3 seconds for BullMQ worker to provision Maildir...")
    time.sleep(3)

    # Check job status
    res = requests.get(f"{BASE_URL}/api/admin/jobs/{job_id}", headers=admin_headers)
    job_record = res.json()
    print(f"✅ BullMQ Job Status: {job_record['status']}, Attempts: {job_record['attempts']}")

    # -------------------------------------------------------------------------
    # TEST 8: Verify New Mailbox Actually Works Over Real SMTP & IMAP
    # -------------------------------------------------------------------------
    print(f"\n--- Test 8: End-to-End Test: Authenticate & Use New Mailbox ({charlie_email}) ---")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    # 8a: Authenticate new mailbox on Postfix Submission (587) and send email to self
    try:
        print(f"Connecting to SMTP submission port 587 for {charlie_email}...")
        with smtplib.SMTP('localhost', 587, timeout=10) as s:
            s.ehlo('mail.example.test')
            s.starttls(context=ctx)
            s.ehlo('mail.example.test')
            print(f"Authenticating on Postfix SASL with newly provisioned credentials...")
            s.login(charlie_email, charlie_pass)
            print("✅ SASL Authentication SUCCESSFUL on Postfix for newly provisioned mailbox!")

            # Send test message
            msg = MIMEText("Hello Charlie! Your mailbox was just provisioned via BullMQ and API.")
            msg['Subject'] = "Welcome to your new Mailbox"
            msg['From'] = charlie_email
            msg['To'] = charlie_email
            s.send_message(msg)
            print(f"✅ Sent email to {charlie_email}")
    except Exception as e:
        print(f"❌ Postfix authentication/send failed: {e}")
        return False

    time.sleep(2)

    # 8b: Authenticate new mailbox on Dovecot IMAPS (993) and read message
    try:
        print(f"Connecting to Dovecot IMAPS (port 993) for {charlie_email}...")
        imap = imaplib.IMAP4_SSL('localhost', 993, ssl_context=ctx)
        imap.login(charlie_email, charlie_pass)
        print("✅ Dovecot IMAP Authentication SUCCESSFUL for newly provisioned mailbox!")

        status, data = imap.select('INBOX')
        print(f"✅ INBOX accessed! Message count: {data[0].decode()}")
        
        status, search_data = imap.search(None, 'ALL')
        msg_ids = search_data[0].split()
        if not msg_ids:
            print("❌ No messages found in new mailbox INBOX!")
            imap.logout()
            return False
            
        status, fetch_data = imap.fetch(msg_ids[-1], '(RFC822)')
        parsed = email.message_from_bytes(fetch_data[0][1])
        print(f"✅ Retrieved message: '{parsed.get('Subject')}' from '{parsed.get('From')}'")
        signature = parsed.get('DKIM-Signature', '')
        assert re.search(r'(?:^|;)\s*d=' + re.escape(new_domain['name']) + r'(?:;|\s|$)', signature), 'Outbound message missing the provisioned domain DKIM signature'
        assert re.search(r'(?:^|;)\s*s=mailhive(?:;|\s|$)', signature), 'Unexpected DKIM selector'
        print('✅ Real delivered MIME contains the provisioned domain DKIM signature (public DNS verification is a deployment check).')
        imap.logout()
    except Exception as e:
        print(f"❌ Dovecot IMAP check failed: {e}")
        return False

    # 8c: Also authenticate via Webmail API (/api/auth/login)
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": charlie_email,
        "password": charlie_pass
    })
    if res.status_code != 200:
        print(f"❌ Webmail API login failed for new mailbox: {res.status_code}")
        return False
    print("✅ Webmail API Login SUCCESSFUL for newly provisioned mailbox!")

    print("\n==================================================================")
    print("      🎉 ALL PHASE 2 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!   ")
    print("==================================================================")
    return True

if __name__ == '__main__':
    ok = run_phase2_verification()
    sys.exit(0 if ok else 1)
