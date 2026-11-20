import { ImapFlow } from 'imapflow';
import { ImapService } from './imap.service';
import { closeMailClient } from './mail-connection';
import { simpleParser } from 'mailparser';

jest.mock('imapflow', () => ({ ImapFlow: jest.fn() }));
jest.mock('jsdom', () => ({ JSDOM: jest.fn(() => ({ window: {} })) }));
jest.mock('dompurify', () => () => ({ sanitize: (html: string) => html }));

describe('mail reliability regressions', () => {
  beforeEach(() => { process.env.DOVECOT_MASTER_PASSWORD = 'test-only'; });
  const client = () => ({ on: jest.fn(), connect: jest.fn(), close: jest.fn(), logout: jest.fn(), getMailboxLock: jest.fn().mockResolvedValue({ release: jest.fn() }), append: jest.fn().mockResolvedValue({ uid: 42 }), messageDelete: jest.fn(), mailbox: { exists: 3 }, fetch: jest.fn() });
  const service = () => new ImapService({ getClient: () => ({ del: jest.fn() }) } as any);
  it('preserves draft text, Unicode subject and BCC in valid MIME', async () => {
    const c = client(); (ImapFlow as unknown as jest.Mock).mockReturnValue(c);
    await service().saveDraft('alice@example.test', { subject: 'Résumé ✓', textBody: 'Body survives', bcc: ['bob@example.test'] }, 7);
    const raw = c.append.mock.calls[0][1];
    const parsed = await simpleParser(raw);
    expect(parsed.subject).toBe('Résumé ✓');
    expect(parsed.text?.trim()).toBe('Body survives');
    expect((parsed.bcc as any).value[0].address).toBe('bob@example.test');
    expect(c.append.mock.invocationCallOrder[0]).toBeLessThan(c.messageDelete.mock.invocationCallOrder[0]);
  });
  it('keeps the previous draft when APPEND fails', async () => {
    const c = client(); c.append.mockRejectedValue(new Error('quota exceeded')); (ImapFlow as unknown as jest.Mock).mockReturnValue(c);
    await expect(service().saveDraft('alice@example.test', { textBody: 'hello' }, 7)).rejects.toThrow('quota exceeded');
    expect(c.messageDelete).not.toHaveBeenCalled();
  });
  it('does not return oldest mail for out-of-range pagination', async () => {
    const c = client(); (ImapFlow as unknown as jest.Mock).mockReturnValue(c);
    expect((await service().listMessages('alice@example.test', 'INBOX', 10, 50)).data).toEqual([]);
    expect(c.fetch).not.toHaveBeenCalled();
  });
  it('cleanup never masks the failed command', async () => {
    const c = client(); c.logout.mockRejectedValue(new Error('connection unavailable'));
    await expect(closeMailClient(c as any)).resolves.toBeUndefined();
    expect(c.close).toHaveBeenCalled();
  });
});
