#!/usr/bin/env python3
"""Verify that moving a real message changes Rspamd's training counters."""
import time
from pathlib import Path
import requests

BASE = 'http://127.0.0.1:4000/api'
env = dict(line.strip().split('=',1) for line in (Path(__file__).resolve().parents[1] / '.env.dev').read_text().splitlines() if '=' in line and not line.startswith('#'))

def learned():
    r = requests.get('http://127.0.0.1:11334/stat', headers={'Password':env['RSPAMD_PASSWORD']}, timeout=10)
    r.raise_for_status()
    # Per-class revisions are cached and may still precede an unlearn/relearn.
    return r.json()['learned']

def wait_learned(symbol, before):
    for _ in range(30):
        if learned() > before: return
        time.sleep(.2)
    raise AssertionError('No training counter increase for '+symbol)

def check(r):
    r.raise_for_status()
    return r.json() if r.content else None

s = requests.Session()
s.headers['X-Requested-With'] = 'FreeMailo'
check(s.post(BASE+'/auth/login', json={'email':'bob@example.test','password':'bob123456'},timeout=15))
subject = 'Learning regression '+str(time.time_ns())
check(s.post(BASE+'/mail/send', json={'to':['bob@example.test'],'subject':subject,'textBody':'Our project meeting covers plans for the coming week. Please review the agenda and bring your comments about deployment, storage, documentation, monitoring, mail delivery, team schedules and customer feedback. We will discuss those topics and agree on the next steps together.'},timeout=20))

def find(folder):
    for _ in range(25):
        rows = check(s.get(BASE+'/mail/search',params={'folder':folder,'q':'subject:"'+subject+'"'},timeout=10))['data']
        if rows: return rows[0]['uid']
        time.sleep(.2)
    raise AssertionError('Message not found in '+folder)

uid = find('INBOX')
spam_before = learned()
check(s.post(BASE+'/mail/messages/move',json={'sourceFolder':'INBOX','destinationFolder':'Junk','uids':[uid]},timeout=20))
wait_learned('BAYES_SPAM', spam_before)
uid = find('Junk')
ham_before = learned()
check(s.post(BASE+'/mail/messages/move',json={'sourceFolder':'Junk','destinationFolder':'INBOX','uids':[uid]},timeout=20))
wait_learned('BAYES_HAM', ham_before)
print('PASS: real IMAP moves to/from Junk trained Rspamd spam/ham counters.')
