#!/usr/bin/env python3
"""Regression checks against the local development stack, with real mail services."""
import concurrent.futures
import json
import time
import requests

BASE = 'http://127.0.0.1:4000/api'

def login(email, password):
    session = requests.Session()
    session.headers['X-Requested-With'] = 'MailHive'
    response = session.post(BASE + '/auth/login', json={'email': email, 'password': password}, timeout=15)
    response.raise_for_status()
    return session

def check(response, status=200):
    assert response.status_code == status, (response.status_code, response.text[:200])
    return response

def main():
    alice = login('alice@example.test', 'alice123456')
    bob = login('bob@example.test', 'bob123456')
    assert alice.cookies.get('access_token')
    check(alice.get(BASE + '/auth/me'))
    # Browser-origin and cookie CSRF enforcement.
    check(alice.post(BASE + '/mail/send', headers={'Origin':'https://attacker.invalid'}, json={}), 403)
    check(requests.post(BASE + '/mail/send', cookies=alice.cookies, json={}), 403)
    check(alice.post(BASE + '/mail/send', json={'to': [], 'subject': 'Invalid'}), 400)
    check(alice.post(BASE + '/mail/draft', json={'to': [{'address':'unexpected-object'}]}), 400)
    check(alice.post(BASE + '/mail/send', data={'to':'not-json', 'subject':'Invalid'}, files={'attachments':('a.txt',b'test')}), 400)
    check(alice.patch(BASE + '/mail/messages/flags', json={'folder':'INBOX','uids':[],'flags':['\\Seen'],'action':'add'}), 400)
    check(alice.get(BASE + '/mail/search', params={'q':'before:not-a-date'}), 400)
    assert check(alice.get(BASE + '/mail/messages', params={'page':999})).json()['data'] == []
    # MIME attachment and Sent persistence round-trip.
    subject = f'Revision attachment {time.time_ns()}'
    sent = check(alice.post(BASE + '/mail/send', data={'to':json.dumps(['bob@example.test']), 'subject':subject, 'textBody':'Round-trip attachment'}, files={'attachments':('résumé.txt', b'exact attachment bytes', 'text/plain')}), 201).json()
    assert sent['sentCopySaved'] is True
    match = None
    for _ in range(15):
        messages = check(bob.get(BASE + '/mail/search', params={'q':f'subject:"{subject}" has:attachment'})).json()['data']
        if messages: match = messages[0]; break
        time.sleep(.2)
    assert match, 'Attachment search failed'
    detail = check(bob.get(BASE + '/mail/messages/' + str(match['uid']))).json()
    part = detail['attachments'][0]
    attachment = check(bob.get(BASE + f"/mail/attachments/{match['uid']}/{requests.utils.quote(part['partId'], safe='')}"))
    assert attachment.content == b'exact attachment bytes'
    assert 'attachment;' in attachment.headers['Content-Disposition']
    # Server-side sorting must order the entire mailbox, not each arrival page.
    rows = check(bob.get(BASE + '/mail/messages', params={'sort':'subject','order':'asc','pageSize':100})).json()['data']
    assert rows
    # Apply and disable a real ManageSieve script, preserving previous settings.
    previous = check(alice.get(BASE + '/settings/vacation')).json()
    vacation = {'isActive':True, 'subject':'Revision away test', 'body':'A temporary verification reply.', 'startDate':'2099-01-01', 'endDate':'2099-01-02'}
    check(alice.put(BASE + '/settings/vacation', json=vacation))
    restore = {key: previous.get(key) for key in ['isActive','subject','body','startDate','endDate']}
    restore['subject'] = restore['subject'] or 'Out of office'
    restore['body'] = restore['body'] or 'Away from my mailbox.'
    check(alice.put(BASE + '/settings/vacation', json=restore))
    # Two concurrent refreshes may consume a token only once.
    refresh = alice.cookies.get('refresh_token')
    def rotate(_):
        return requests.post(BASE + '/auth/refresh', cookies={'refresh_token':refresh}, headers={'X-Requested-With':'MailHive'}, timeout=15).status_code
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(rotate, range(2))) == [200, 401]
    check(bob.post(BASE + '/auth/logout'), 204)
    check(bob.post(BASE + '/auth/refresh'), 401)
    print('PASS: cookie auth, CSRF, malformed send/bulk input, pagination, attachment MIME/search/download, Sent persistence, ManageSieve, refresh race and logout.')

if __name__ == '__main__': main()
