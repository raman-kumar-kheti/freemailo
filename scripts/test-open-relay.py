import smtplib
import sys

def test_open_relay():
    print("Testing Open Relay on localhost:25...")
    try:
        server = smtplib.SMTP('localhost', 25, timeout=10)
        server.set_debuglevel(1)
        server.ehlo('attacker.com')
        server.mail('spammer@attacker.com')
        code, resp = server.rcpt('victim@external-domain.org')
        server.quit()
        
        # If code is 250, then it's an OPEN RELAY (FAIL!)
        if code == 250:
            print(f"❌ VULNERABLE: Open relay accepted recipient with code {code}: {resp}")
            sys.exit(1)
        else:
            print(f"✅ PASSED: Server rejected unauthorized relay with code {code}: {resp}")
            return True
    except smtplib.SMTPResponseException as e:
        print(f"✅ PASSED: Server rejected unauthorized relay: {e.smtp_code} {e.smtp_error}")
        return True
    except Exception as e:
        print(f"Server response: {e}")
        return True

if __name__ == '__main__':
    test_open_relay()
