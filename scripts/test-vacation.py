#!/usr/bin/env python3
"""Verify an actual Sieve reply using a temporary, API-provisioned mailbox."""
import time
import requests

BASE = 'http://127.0.0.1:4000/api'
def session(path, email, password):
    s = requests.Session()
    s.headers['X-Requested-With'] = 'MailHive'
    response = s.post(BASE + path, json={'email':email, 'password':password}, timeout=15)
    response.raise_for_status()
    return s

def checked(response):
    response.raise_for_status()
    return response.json() if response.content else None

admin = session('/auth/admin/login', 'admin@mailhive.local', 'admin123456')
bob = session('/auth/login', 'bob@example.test', 'bob123456')
domains = checked(admin.get(BASE + '/admin/domains'))['data']
domain = next(d for d in domains if d['name'] == 'example.test')
marker = str(time.time_ns())
local = 'away' + marker
password = 'VacationRegression123!'
created = checked(admin.post(BASE + '/admin/mailboxes', json={'localPart':local, 'domainId':domain['id'], 'password':password, 'quotaBytes':10485760}))
mailbox = created['mailbox']
try:
    for _ in range(30):
        job = checked(admin.get(BASE + '/admin/jobs/' + created['jobId']))
        if job['status'] == 'COMPLETED': break
        time.sleep(1)
    assert job['status'] == 'COMPLETED', job['status']
    away = session('/auth/login', mailbox['email'], password)
    subject = 'Vacation regression ' + marker
    checked(away.put(BASE + '/settings/vacation', json={'isActive':True, 'subject':subject, 'body':'This is a real Sieve-generated reply.'}))
    checked(bob.post(BASE + '/mail/send', json={'to':[mailbox['email']], 'subject':'Trigger '+marker, 'textBody':'Please send the automatic reply.'}))
    reply = None
    for _ in range(30):
        rows = checked(bob.get(BASE + '/mail/search', params={'q':'subject:"'+subject+'"'}))['data']
        if rows:
            reply = checked(bob.get(BASE + '/mail/messages/' + str(rows[0]['uid'])))
            break
        time.sleep(1)
    assert reply, 'Vacation reply was not delivered; inspect Dovecot and Postfix logs'
    assert 'Sieve-generated reply' in (reply.get('textBody') or reply.get('htmlBody') or ''), reply.keys()
    print('PASS: API provisioning -> ManageSieve activation -> incoming SMTP -> real automatic reply delivered to Bob.')
finally:
    response = admin.delete(BASE + '/admin/mailboxes/' + mailbox['id'])
    response.raise_for_status()
