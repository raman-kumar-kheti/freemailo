import { ImapFlow } from 'imapflow';
import { ConnectionOptions } from 'tls';

export function mailTlsOptions(): ConnectionOptions {
  return {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: process.env.MAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
    ...(process.env.MAIL_TLS_SERVERNAME ? { servername: process.env.MAIL_TLS_SERVERNAME } : {}),
  };
}

export function masterAuth(email: string) {
  const password = process.env.DOVECOT_MASTER_PASSWORD;
  if (!password) throw new Error('DOVECOT_MASTER_PASSWORD must be configured');
  return { user: `${email}*${process.env.DOVECOT_MASTER_USER || 'mailhive_master'}`, pass: password };
}

export function createMailClient(email: string, password?: string): ImapFlow {
  const client = new ImapFlow({
    host: process.env.DOVECOT_HOST || 'dovecot',
    port: Number(process.env.DOVECOT_IMAP_PORT || 993),
    secure: true,
    auth: password === undefined ? masterAuth(email) : { user: email, pass: password },
    tls: mailTlsOptions(),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 60000,
    logger: false,
  });
  // Network failures also arrive as events. Commands still reject, allowing the
  // HTTP boundary to report them without crashing the process.
  client.on('error', () => {});
  return client;
}

export async function closeMailClient(client: ImapFlow): Promise<void> {
  try {
    await client.logout();
  } catch {
    // A broken connection cannot LOGOUT. Cleanup must not replace the original
    // command error or turn a successful mutation into a retryable failure.
    client.close();
  }
}
