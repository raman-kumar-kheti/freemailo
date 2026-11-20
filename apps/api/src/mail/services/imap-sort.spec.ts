import { sortedUids } from './imap-sort';

describe('Dovecot server-side sorting', () => {
  it('passes validated atoms and preserves returned UID order', async () => {
    const next = jest.fn();
    const exec = jest.fn(async (_command, _attrs, options) => { options.untagged.SORT({ attributes: [{ value: '19' }, { value: '2' }] }); return { next }; });
    expect(await sortedUids({ exec } as any, 'subject', 'asc')).toEqual([19, 2]);
    expect(exec.mock.calls[0][0]).toBe('UID SORT');
    expect(exec.mock.calls[0][1][0]).toEqual([{ type: 'ATOM', value: 'SUBJECT' }]);
    expect(next).toHaveBeenCalled();
  });
});
