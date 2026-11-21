require ["vnd.dovecot.pipe", "copy", "imapsieve", "environment", "variables"];

# Deleting spam is not evidence that it was legitimate mail.
if environment :is "imap.mailbox" "Trash" { stop; }
pipe :copy "learn-ham";
