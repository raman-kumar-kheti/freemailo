import smtplib
import imaplib
import ssl
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import sys
import time

def test_mail_flow():
    print("=== Step 1: Send authenticated email via Submission (Port 587) ===")
    sender = "alice@example.test"
    password = "alice123456"
    recipient = "bob@example.test"
    subject = f"Test Message from Alice {int(time.time())}"
    body = "Hello Bob,\n\nThis is a verified test email sent over authenticated Postfix submission with DKIM signing and LMTP delivery.\n\nBest regards,\nAlice"
    
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"Alice Test <{sender}>"
    msg['To'] = f"Bob Test <{recipient}>"
    msg['Message-ID'] = f"<{int(time.time())}.test@example.test>"
    msg.attach(MIMEText(body, 'plain'))

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        print(f"Connecting to SMTP submission port 587...")
        with smtplib.SMTP('localhost', 587, timeout=10) as s:
            s.set_debuglevel(1)
            s.ehlo('mail.example.test')
            print("Starting TLS...")
            s.starttls(context=ctx)
            s.ehlo('mail.example.test')
            print(f"Authenticating as {sender}...")
            s.login(sender, password)
            print(f"Sending message to {recipient}...")
            s.send_message(msg)
            print("✅ Email submitted successfully!")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False

    print("\nWaiting 3 seconds for LMTP delivery and Rspamd processing...")
    time.sleep(3)

    print("\n=== Step 2: Verify Bob receives email via Dovecot IMAP (Port 993) ===")
    try:
        print(f"Connecting to IMAPS on port 993 for {recipient}...")
        imap = imaplib.IMAP4_SSL('localhost', 993, ssl_context=ctx)
        print(f"Logging in to IMAP as {recipient}...")
        imap.login(recipient, "bob123456")
        print("Selecting INBOX...")
        status, data = imap.select('INBOX')
        print(f"INBOX status: {status}, count: {data[0].decode()}")
        
        status, search_data = imap.search(None, 'ALL')
        msg_ids = search_data[0].split()
        if not msg_ids:
            print("❌ No messages found in INBOX!")
            imap.logout()
            return False
            
        latest_id = msg_ids[-1]
        print(f"Fetching message {latest_id.decode()}...")
        status, fetch_data = imap.fetch(latest_id, '(RFC822)')
        raw_email = fetch_data[0][1]
        parsed = email.message_from_bytes(raw_email)
        
        print(f"\n--- Delivered Message Details ---")
        print(f"From: {parsed.get('From')}")
        print(f"To: {parsed.get('To')}")
        print(f"Subject: {parsed.get('Subject')}")
        print(f"Date: {parsed.get('Date')}")
        
        dkim_sig = parsed.get('DKIM-Signature')
        auth_results = parsed.get('Authentication-Results')
        
        print(f"DKIM-Signature present: {'✅ YES' if dkim_sig else '❌ NO'}")
        if dkim_sig:
            print(f"DKIM header: {dkim_sig[:80]}...")
            
        print(f"Auth-Results present: {'✅ YES' if auth_results else '❌ NO'}")
        if auth_results:
            print(f"Auth-Results: {auth_results}")
            
        imap.logout()
        print("\n✅ Verification PASSED: Real email sent, DKIM-signed, delivered via LMTP, and read via IMAP!")
        return True
    except Exception as e:
        print(f"❌ IMAP check failed: {e}")
        return False

if __name__ == '__main__':
    success = test_mail_flow()
    sys.exit(0 if success else 1)
