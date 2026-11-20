import { ImapFlow } from 'imapflow';

// ImapFlow 2.12 does not expose SORT. Keep its wire adapter isolated and pinned;
// only fixed, validated atoms enter the command. Never fetch full message bodies
// to sort a mailbox. Dovecot implements RFC 5256 SORT.
export async function sortedUids(client: ImapFlow, field: string, order: string): Promise<number[]> {
  const fields: Record<string, string> = { date: 'DATE', from: 'FROM', subject: 'SUBJECT', size: 'SIZE' };
  const sort = fields[field];
  if (!sort || !['asc', 'desc'].includes(order)) throw new Error('Invalid sort');
  const atoms = (order === 'desc' ? ['REVERSE', sort] : [sort]).map(value => ({ type: 'ATOM', value }));
  let uids: number[] = [];
  const connection = client as unknown as { exec: (command: string, attributes: unknown[], options: unknown) => Promise<{ next: () => void }> };
  const response = await connection.exec('UID SORT', [atoms, { type: 'ATOM', value: 'UTF-8' }, { type: 'ATOM', value: 'ALL' }], {
    untagged: { SORT: (result: { numbers?: number[]; attributes?: { value: string }[] }) => {
      uids = result.numbers || (result.attributes || []).map(a => Number(a.value)).filter(uid => Number.isSafeInteger(uid) && uid > 0);
    } },
  });
  response.next();
  return uids;
}
