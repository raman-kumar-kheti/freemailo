#!/usr/bin/env python3
"""The harmless public-domain GTUBE string must be rejected by the real milter."""
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

message = EmailMessage()
message['From'] = 'alice@example.test'
message['To'] = 'bob@example.test'
message['Subject'] = 'MailHive GTUBE rejection check'
message['Date'] = formatdate(localtime=True)
message['Message-ID'] = make_msgid(domain='example.test')
message.set_content('XJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X')
with smtplib.SMTP('127.0.0.1', 587, timeout=15) as smtp:
    smtp.ehlo('mail.example.test')
    smtp.starttls(context=ssl._create_unverified_context())
    smtp.ehlo('mail.example.test')
    smtp.login('alice@example.test', 'alice123456')
    try:
        smtp.send_message(message)
    except smtplib.SMTPDataError as error:
        assert error.smtp_code in (550, 554), (error.smtp_code, error.smtp_error)
        assert b'spam' in error.smtp_error.lower() or b'gtube' in error.smtp_error.lower(), error.smtp_error
    else:
        raise AssertionError('GTUBE was accepted: the Rspamd rejection path is broken')
print('PASS: Postfix/Rspamd rejected GTUBE during DATA; message was not queued for delivery.')
