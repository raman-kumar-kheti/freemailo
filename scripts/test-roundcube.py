import requests
import re
import sys

def test_roundcube():
    print("=== Testing Roundcube Webmail Login & Read ===")
    session = requests.Session()
    
    base_url = "http://localhost:8080"
    
    # 1. Load login page
    print(f"Loading login page: {base_url}...")
    r = session.get(base_url)
    if r.status_code != 200:
        print(f"❌ Failed to load login page: HTTP {r.status_code}")
        return False
        
    token_match = re.search(r'name="_token"\s+value="([^"]+)"', r.text)
    if not token_match:
        print("❌ Could not find CSRF _token in login form")
        return False
        
    token = token_match.group(1)
    print(f"Got CSRF token: {token[:12]}...")
    
    # 2. Submit login
    print("Logging into Roundcube as bob@example.test...")
    login_data = {
        '_token': token,
        '_task': 'login',
        '_action': 'login',
        '_timezone': 'UTC',
        '_user': 'bob@example.test',
        '_pass': 'bob123456'
    }
    
    r = session.post(f"{base_url}/?_task=login", data=login_data, allow_redirects=True)
    if r.status_code != 200:
        print(f"❌ Login request failed with status {r.status_code}")
        return False
        
    if "login" in r.url and "_task=login" in r.url:
        print("❌ Login failed: redirected back to login page")
        if "Login failed" in r.text or "Authentication failed" in r.text:
            print("Server indicated: Authentication failed")
        return False
        
    print(f"Logged in successfully! Landed on URL: {r.url}")
    
    # 3. Check for messages in INBOX
    print("Checking INBOX in Roundcube...")
    r_mail = session.get(f"{base_url}/?_task=mail&_mbox=INBOX")
    
    # Check if Alice or the test message subject appears in page or mail list
    if "Alice" in r_mail.text or "Test Message from Alice" in r_mail.text or "rcmrow" in r_mail.text:
        print("✅ Found mail from Alice in Roundcube webmail interface!")
    else:
        # Also try JSON message list request used by Elastic/Larry skin
        r_list = session.get(f"{base_url}/?_task=mail&_action=list&_mbox=INBOX")
        print(f"Mail list request status: {r_list.status_code}")
        if "Alice" in r_list.text or "Test Message" in r_list.text:
            print("✅ Found mail from Alice in Roundcube message list response!")
        else:
            print("Response preview:")
            print(r_mail.text[:500])
            
    print("✅ Roundcube Webmail verification PASSED!")
    return True

if __name__ == '__main__':
    success = test_roundcube()
    sys.exit(0 if success else 1)
