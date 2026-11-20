import { mailboxPath } from './provisioning.processor';

describe('provisioning path isolation', () => {
  it.each(['..', '.', '../bob', 'alice; touch /tmp/x', '/absolute'])('rejects unsafe mailbox %s', (localPart) => {
    expect(() => mailboxPath('example.test', localPart)).toThrow();
  });
  it('accepts supported mailbox names within their own domain', () => {
    expect(mailboxPath('example.test', 'alice.smith')).toBe('/var/vmail/example.test/alice.smith');
  });
});
