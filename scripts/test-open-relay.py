#!/usr/bin/env python3
import smtplib

# Test fails on connectivity errors; a disconnected server is not relay evidence.
with smtplib.SMTP('127.0.0.1', 25, timeout=10) as server:
    server.ehlo('attacker.example')
    assert not server.has_extn('auth'), 'Inbound SMTP must not advertise AUTH'
    # Null reverse path bypasses sender-DNS policy, isolating relay enforcement.
    code, _ = server.mail('')
    assert code == 250, 'MAIL must be accepted so recipient relay enforcement is tested'
    code, response = server.rcpt('recipient@example.net')
    assert code in (550, 554) and b'relay' in response.lower(), (code, response)
print('PASS: inbound AUTH disabled; unauthenticated relay explicitly rejected.')
