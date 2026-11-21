#!/usr/bin/env python3
"""Verify SMTP input cannot forge the webmail authentication badges."""
import smtplib
import ssl
import time
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
import requests

BASE = 'http://127.0.0.1:4000/api'
session = requests.Session()
session.headers['X-Requested-With'] = 'MailHive'
session.post(BASE + '/auth/login', json={'email': 'bob@example.test', 'password': 'bob123456'}, timeout=15).raise_for_status()

for port in (25, 587):
    subject = f'Authentication boundary {port} {time.time_ns()}'
    message = EmailMessage()
    message['From'] = 'alice@example.test'
    message['To'] = 'bob@example.test'
    message['Subject'] = subject
    message['Date'] = formatdate(localtime=True)
    message['Message-ID'] = make_msgid(domain='example.test')
    for issuer in ('attacker.invalid', 'mail.example.test'):
        message['Authentication-Results'] = f'{issuer}; spf=pass; dkim=pass; dmarc=pass (forged-mailhive-result)'
    message.set_content('Local authentication header regression check.')
    with smtplib.SMTP('127.0.0.1', port, timeout=15) as smtp:
        smtp.ehlo('mail.example.test')
        smtp.starttls(context=ssl._create_unverified_context())
        smtp.ehlo('mail.example.test')
        if port == 587:
            smtp.login('alice@example.test', 'alice123456')
        # Null reverse path on inbound avoids unrelated sender-DNS checks.
        smtp.sendmail('alice@example.test' if port == 587 else '', ['bob@example.test'], message.as_bytes())
    rows = []
    for _ in range(30):
        response = session.get(BASE + '/mail/search', params={'q': f'subject:"{subject}"'}, timeout=15)
        response.raise_for_status()
        rows = response.json()['data']
        if rows:
            break
        time.sleep(.2)
    assert rows, f'No delivered test message on port {port}'
    uid = rows[0]['uid']
    detail = session.get(BASE + f'/mail/messages/{uid}', timeout=15)
    detail.raise_for_status()
    raw = session.get(BASE + f'/mail/messages/{uid}/raw', timeout=15)
    raw.raise_for_status()
    assert 'forged-mailhive-result' not in raw.text, f'Untrusted result survived port {port}'
    header = detail.json()['headers'].get('authentication-results', '')
    expected_issuer = 'mail.example.test' if port == 25 else 'ORIGINATING'
    assert header.startswith(expected_issuer + ';'), f'Missing local result: {header}'
    if port == 587:
        # Rspamd uses Postfix's ORIGINATING tag on submission, containing
        # SASL auth rather than recipient-side SPF/DKIM/DMARC checks.
        assert detail.json()['authResults'] == {'spf': 'none', 'dkim': 'none', 'dmarc': 'none'}
    assert detail.json()['authResults'] != {'spf': 'pass', 'dkim': 'pass', 'dmarc': 'pass'}, detail.json()['authResults']
    print(f'PASS: port {port} replaced forged authentication headers; API uses local results.')
