#!/usr/bin/env python3
"""Exercise submission authorization without delivering to external addresses."""
import smtplib
import ssl
import subprocess
from pathlib import Path

context = ssl._create_unverified_context()  # Local development certificate only.
with smtplib.SMTP('127.0.0.1', 587, timeout=10) as smtp:
    smtp.ehlo('mail.example.test')
    assert not smtp.has_extn('auth'), 'AUTH exposed before STARTTLS'
    smtp.starttls(context=context)
    smtp.ehlo('mail.example.test')
    smtp.login('alice@example.test', 'alice123456')
    smtp.mail('bob@example.test')
    code, reply = smtp.rcpt('alice@example.test')
    assert code == 553 and b'not owned' in reply.lower(), (code,reply)
    smtp.rset()
    smtp.mail('alice@example.test')
    code, reply = smtp.rcpt('bob@example.test')
    assert code == 250, (code,reply)
    smtp.rset()

ip = subprocess.check_output(['docker','inspect','--format','{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}','mailhive-postfix'], text=True).split()[0]
with smtplib.SMTP_SSL(ip, 2525, context=context, timeout=10) as smtp:
    smtp.ehlo('mail.example.test')
    smtp.mail('')
    code, reply = smtp.rcpt('nobody@external.invalid')
    assert code in (450, 454, 550, 554), (code,reply)

root = Path(__file__).resolve().parents[1]
context.load_cert_chain(root / 'certs/mail.crt', root / 'certs/mail.key')
with smtplib.SMTP_SSL(ip, 2525, context=context, timeout=10) as smtp:
    smtp.ehlo('mail.example.test')
    smtp.mail('')
    code, reply = smtp.rcpt('nobody@external.invalid')
    assert code == 250, (code,reply)
    smtp.rset()  # No DATA and no external delivery.
print('PASS: TLS before AUTH, sender ownership, no-certificate relay denied, pinned Sieve certificate authorized.')
