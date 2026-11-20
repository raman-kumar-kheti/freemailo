// Uses an isolated development mailbox, never an existing user's mailbox.
const { ImapFlow } = require('../apps/api/node_modules/imapflow');
const { randomBytes } = require('crypto');
const base = process.env.TEST_API_URL || 'http://127.0.0.1:4000/api';
const count = Number(process.env.TEST_MESSAGE_COUNT || 10000);
async function request(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.status === 204 ? {} : response.json();
}
(async () => {
  const admin = await request('/auth/admin/login', null, { email: process.env.TEST_ADMIN_EMAIL || 'admin@mailhive.local', password: process.env.TEST_ADMIN_PASSWORD || 'admin123456' });
  const domain = (await request('/admin/domains?pageSize=100', admin.accessToken)).data.find(d => d.name === 'example.test');
  if (!domain) throw new Error('Development example.test domain required');
  const localPart = `load-${Date.now()}`;
  const password = randomBytes(24).toString('base64url');
  const created = await request('/admin/mailboxes', admin.accessToken, { domainId: domain.id, localPart, password });
  const email = `${localPart}@example.test`;
  const client = new ImapFlow({ host: '127.0.0.1', port: 993, secure: true, auth: { user: email, pass: password }, tls: { rejectUnauthorized: false }, logger: false });
  client.on('error', () => {});
  try {
    await client.connect();
    for (let i = 0; i < count; i++) {
      const raw = `From: load@example.test\r\nTo: ${email}\r\nSubject: Load ${String(i).padStart(5, '0')}\r\nDate: ${new Date(1700000000000 + i * 1000).toUTCString()}\r\nMessage-ID: <${i}.${localPart}@example.test>\r\n\r\nIsolated performance fixture.\r\n`;
      await client.append('INBOX', raw);
      if (i % 1000 === 999) console.log(`Appended ${i + 1} messages`);
    }
    const auth = await request('/auth/login', null, { email, password });
    const times = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const result = await request(`/mail/messages?folder=INBOX&page=${i + 1}&pageSize=50`, auth.accessToken);
      times.push(performance.now() - start);
      if (result.total !== count || result.data.length !== Math.min(50, Math.max(0, count - i * 50))) throw new Error('Incorrect pagination');
    }
    const ascending = await request('/mail/messages?sort=subject&order=asc&pageSize=1', auth.accessToken);
    if (ascending.data[0].subject !== 'Load 00000') throw new Error('Global server sort failed');
    const abort = new AbortController();
    const events = await fetch(base + '/mail/events', { headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: abort.signal });
    if (!events.ok) throw new Error('SSE failed');
    const reader = events.body.getReader();
    await reader.read(); // Connected frame; allow IMAP IDLE setup to complete.
    await new Promise(resolve => setTimeout(resolve, 300));
    const started = performance.now();
    const timeout = setTimeout(() => abort.abort(), 5000);
    await client.append('INBOX', `From: load@example.test\r\nTo: ${email}\r\nSubject: Realtime probe\r\n\r\nProbe\r\n`);
    let buffer = '';
    while (!buffer.includes('new_mail')) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('SSE ended without notification');
      buffer += new TextDecoder().decode(chunk.value);
    }
    const realtimeMs = performance.now() - started;
    clearTimeout(timeout); abort.abort();
    times.sort((a, b) => a - b);
    console.log(JSON.stringify({ messages: count, samples: times.length, p95Ms: Math.round(times[18]), maxMs: Math.round(times[19]), realtimeMs: Math.round(realtimeMs) }));
    if (times[18] >= 1000 || realtimeMs >= 2000) throw new Error('Performance target missed');
  } finally {
    await client.logout().catch(() => client.close());
    await request(`/admin/mailboxes/${created.mailbox.id}`, admin.accessToken, undefined, 'DELETE');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
