require ["vnd.dovecot.pipe", "copy", "imapsieve", "environment", "variables"];

pipe :copy "rspamc" ["learn_ham"];
