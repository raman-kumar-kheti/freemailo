import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { JSDOM } from 'jsdom';
import { RedisService } from '../../redis/redis.module';
import { SaveDraftDto } from '../dto/save-draft.dto';

async function streamToBuffer(stream: any): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Setup DOMPurify with JSDOM
const domWindow = new JSDOM('').window;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createDOMPurify = require('dompurify');
const purify = (typeof createDOMPurify === 'function' ? createDOMPurify : createDOMPurify.default)(domWindow);

export interface FolderDto {
  name: string;
  path: string;
  delimiter: string;
  specialUse: string | null;
  total: number;
  unread: number;
  children: FolderDto[];
}

export interface MessageListItemDto {
  uid: number;
  messageId: string;
  threadId: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  subject: string;
  snippet: string;
  date: string;
  flags: string[];
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labels: string[];
  size: number;
}

export interface AuthResultsDto {
  spf: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none';
  dkim: 'pass' | 'fail' | 'none';
  dmarc: 'pass' | 'fail' | 'none';
}

export interface AttachmentMetaDto {
  partId: string;
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
}

export interface MessageDetailDto {
  uid: number;
  messageId: string;
  threadId: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  cc: Array<{ name: string; address: string }>;
  bcc: Array<{ name: string; address: string }>;
  replyTo: Array<{ name: string; address: string }>;
  subject: string;
  date: string;
  flags: string[];
  isRead: boolean;
  isStarred: boolean;
  htmlBody: string;
  textBody: string;
  attachments: AttachmentMetaDto[];
  headers: Record<string, string>;
  authResults: AuthResultsDto;
}

@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Helper to create an authenticated ImapFlow client using master user
   */
  private createClient(email: string): ImapFlow {
    const host = process.env.DOVECOT_HOST || 'dovecot';
    const port = parseInt(process.env.DOVECOT_IMAP_PORT || '993', 10);
    const masterUser = process.env.DOVECOT_MASTER_USER || 'mailhive_master';
    const masterPassword = process.env.DOVECOT_MASTER_PASSWORD || 'mailhive_master_secret_2026';

    return new ImapFlow({
      host,
      port,
      secure: true,
      auth: {
        user: `${email}*${masterUser}`,
        pass: masterPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
      logger: false,
    });
  }

  /**
   * List IMAP folders with message counts
   */
  async listFolders(email: string): Promise<FolderDto[]> {
    const cacheKey = `mailhive:folders:${email}`;
    const redis = this.redisService.getClient();

    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }

    const client = this.createClient(email);
    await client.connect();

    try {
      const folders = await client.list();
      const result: FolderDto[] = [];

      for (const f of folders) {
        let total = 0;
        let unread = 0;
        try {
          const status = await client.status(f.path, { messages: true, unseen: true });
          if (status) {
            total = status.messages || 0;
            unread = status.unseen || 0;
          }
        } catch (err) {
          this.logger.debug(`Could not get status for folder ${f.path}: ${err.message}`);
        }

        // Determine special-use flag
        let specialUse = f.specialUse || null;
        if (!specialUse) {
          const lowerName = f.name.toLowerCase();
          if (lowerName === 'inbox') specialUse = '\\Inbox';
          else if (lowerName === 'sent') specialUse = '\\Sent';
          else if (lowerName === 'drafts') specialUse = '\\Drafts';
          else if (lowerName === 'trash') specialUse = '\\Trash';
          else if (lowerName === 'junk' || lowerName === 'spam') specialUse = '\\Junk';
          else if (lowerName === 'archive') specialUse = '\\Archive';
        }

        result.push({
          name: f.name,
          path: f.path,
          delimiter: f.delimiter,
          specialUse,
          total,
          unread,
          children: [],
        });
      }

      // Cache folder list for 15 seconds
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 15);
      return result;
    } finally {
      await client.logout();
    }
  }

  /**
   * Invalidate folders cache for a user
   */
  async invalidateFoldersCache(email: string): Promise<void> {
    const redis = this.redisService.getClient();
    await redis.del(`mailhive:folders:${email}`);
  }

  /**
   * List messages in a folder with pagination
   */
  async listMessages(
    email: string,
    folder = 'INBOX',
    page = 1,
    pageSize = 50,
    sortField = 'date',
    sortOrder = 'desc',
  ) {
    const client = this.createClient(email);
    await client.connect();

    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const mailboxObj: any = client.mailbox;
        const total = (mailboxObj && typeof mailboxObj.exists === 'number') ? mailboxObj.exists : 0;
        if (total === 0) {
          return {
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }

        // Fetch all sequence ranges or paginated fetch
        // In IMAP, sequences are 1-based from 1 to total (1 is oldest, total is newest)
        // For date desc: newest messages are (total - offset) down to (total - offset - limit + 1)
        const messages: MessageListItemDto[] = [];
        const startSeq = Math.max(1, total - (page * pageSize) + 1);
        const endSeq = Math.max(1, total - ((page - 1) * pageSize));

        if (startSeq <= total && endSeq >= 1) {
          const seqRange = `${startSeq}:${endSeq}`;
          for await (const msg of client.fetch(seqRange, {
            uid: true,
            envelope: true,
            flags: true,
            bodyStructure: true,
            internalDate: true,
            size: true,
          })) {
            const flags = Array.from(msg.flags || []);
            const fromAddr = msg.envelope?.from?.[0] || { name: '', address: '' };
            const toAddrs = (msg.envelope?.to || []).map((t: any) => ({
              name: t.name || '',
              address: t.address || '',
            }));

            // Check if message has attachments from bodyStructure
            const hasAttachments = this.checkHasAttachments(msg.bodyStructure);

            messages.push({
              uid: msg.uid,
              messageId: msg.envelope?.messageId || `<${msg.uid}@local>`,
              threadId: msg.envelope?.inReplyTo || msg.envelope?.messageId || `<${msg.uid}@local>`,
              from: { name: fromAddr.name || fromAddr.address || '', address: fromAddr.address || '' },
              to: toAddrs,
              subject: msg.envelope?.subject || '(no subject)',
              snippet: '', // Populated if needed
              date: new Date(msg.envelope?.date || msg.internalDate || Date.now()).toISOString(),
              flags,
              isRead: flags.includes('\\Seen'),
              isStarred: flags.includes('\\Flagged'),
              hasAttachments,
              labels: flags.filter((flag) => flag.startsWith('MailHive_')).map((flag) => flag.slice(9)),
              size: msg.size || 0,
            });
          }
        }

        // Sort results
        messages.sort((a, b) => {
          if (sortField === 'date') {
            const tA = new Date(a.date).getTime();
            const tB = new Date(b.date).getTime();
            return sortOrder === 'desc' ? tB - tA : tA - tB;
          }
          if (sortField === 'subject') {
            return sortOrder === 'desc'
              ? b.subject.localeCompare(a.subject)
              : a.subject.localeCompare(b.subject);
          }
          if (sortField === 'from') {
            return sortOrder === 'desc'
              ? b.from.address.localeCompare(a.from.address)
              : a.from.address.localeCompare(b.from.address);
          }
          if (sortField === 'size') {
            return sortOrder === 'desc' ? b.size - a.size : a.size - b.size;
          }
          return 0;
        });

        const totalPages = Math.ceil(total / pageSize);
        return {
          data: messages,
          total,
          page,
          pageSize,
          totalPages,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Helper to check if bodyStructure indicates attachments
   */
  private checkHasAttachments(structure: any): boolean {
    if (!structure) return false;
    if (structure.childNodes && Array.isArray(structure.childNodes)) {
      for (const child of structure.childNodes) {
        if (child.disposition?.toLowerCase() === 'attachment') return true;
        if (child.type && !['text/plain', 'text/html', 'multipart/alternative'].includes(child.type.toLowerCase())) {
          return true;
        }
        if (this.checkHasAttachments(child)) return true;
      }
    }
    return structure.disposition?.toLowerCase() === 'attachment';
  }

  /**
   * Get full parsed email message
   */
  async getMessage(email: string, folder = 'INBOX', uid: number): Promise<MessageDetailDto> {
    const client = this.createClient(email);
    await client.connect();

    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const downloadResult = await client.download(uid.toString(), undefined, { uid: true });
        if (!downloadResult || !downloadResult.content) {
          throw new NotFoundException(`Message with UID ${uid} not found in ${folder}`);
        }

        // Parse with mailparser
        const parsed: ParsedMail = await simpleParser(downloadResult.content);

        // Fetch flags for this UID
        let flags: string[] = [];
        for await (const msg of client.fetch(uid.toString(), { uid: true, flags: true }, { uid: true })) {
          flags = Array.from(msg.flags || []);
        }

        // Sanitize HTML body with DOMPurify
        let htmlBody = '';
        if (parsed.html) {
          htmlBody = purify.sanitize(parsed.html);
        } else if (parsed.textAsHtml) {
          htmlBody = purify.sanitize(parsed.textAsHtml);
        }

        // Extract attachments
        const attachments: AttachmentMetaDto[] = (parsed.attachments || []).map((att, idx) => ({
          partId: att.contentId || `part-${idx + 1}`,
          filename: att.filename || `attachment-${idx + 1}`,
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || att.content?.length || 0,
          contentId: att.contentId || null,
        }));

        // Flatten headers to string map
        const headers: Record<string, string> = {};
        parsed.headers.forEach((val, key) => {
          headers[key.toLowerCase()] = typeof val === 'object' && val !== null && 'value' in val ? String((val as any).value) : String(val);
        });

        // Parse Authentication-Results header
        const authResults = this.parseAuthenticationResults(headers['authentication-results'] || '');

        const fromAddr = parsed.from?.value?.[0] || { name: '', address: '' };
        const toAddrs = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
          .flatMap((addr) => addr.value || [])
          .map((a) => ({ name: a.name || '', address: a.address || '' }));
        const ccAddrs = (parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
          .flatMap((addr) => addr.value || [])
          .map((a) => ({ name: a.name || '', address: a.address || '' }));
        const bccAddrs = (parsed.bcc ? (Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc]) : [])
          .flatMap((addr) => addr.value || [])
          .map((a) => ({ name: a.name || '', address: a.address || '' }));
        const replyToAddrs = (parsed.replyTo ? (Array.isArray(parsed.replyTo) ? parsed.replyTo : [parsed.replyTo]) : [])
          .flatMap((addr) => addr.value || [])
          .map((a) => ({ name: a.name || '', address: a.address || '' }));

        return {
          uid,
          messageId: parsed.messageId || `<${uid}@local>`,
          threadId: parsed.inReplyTo || parsed.messageId || `<${uid}@local>`,
          from: { name: fromAddr.name || fromAddr.address || '', address: fromAddr.address || '' },
          to: toAddrs,
          cc: ccAddrs,
          bcc: bccAddrs,
          replyTo: replyToAddrs,
          subject: parsed.subject || '(no subject)',
          date: (parsed.date || new Date()).toISOString(),
          flags,
          isRead: flags.includes('\\Seen'),
          isStarred: flags.includes('\\Flagged'),
          htmlBody,
          textBody: parsed.text || '',
          attachments,
          headers,
          authResults,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Get raw RFC 5322 content
   */
  async getRawMessage(email: string, folder = 'INBOX', uid: number): Promise<string> {
    const client = this.createClient(email);
    await client.connect();

    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const downloadResult = await client.download(uid.toString(), undefined, { uid: true });
        if (!downloadResult || !downloadResult.content) {
          throw new NotFoundException(`Message with UID ${uid} not found`);
        }
        const buffer = await streamToBuffer(downloadResult.content);
        return buffer.toString('utf-8');
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Parse Authentication-Results header to determine SPF, DKIM, and DMARC status
   */
  private parseAuthenticationResults(header: string): AuthResultsDto {
    const lower = header.toLowerCase();
    let spf: AuthResultsDto['spf'] = 'none';
    let dkim: AuthResultsDto['dkim'] = 'none';
    let dmarc: AuthResultsDto['dmarc'] = 'none';

    if (lower.includes('spf=pass')) spf = 'pass';
    else if (lower.includes('spf=fail')) spf = 'fail';
    else if (lower.includes('spf=softfail')) spf = 'softfail';
    else if (lower.includes('spf=neutral')) spf = 'neutral';

    if (lower.includes('dkim=pass')) dkim = 'pass';
    else if (lower.includes('dkim=fail')) dkim = 'fail';

    if (lower.includes('dmarc=pass')) dmarc = 'pass';
    else if (lower.includes('dmarc=fail')) dmarc = 'fail';

    return { spf, dkim, dmarc };
  }

  /**
   * Thread conversation retrieval
   */
  async getThread(email: string, threadId: string): Promise<any> {
    // Collect messages across INBOX and Sent that share threadId
    const foldersToSearch = ['INBOX', 'Sent'];
    const matchingMessages: MessageDetailDto[] = [];
    const participantsMap = new Map<string, string>();

    for (const folder of foldersToSearch) {
      try {
        const { data } = await this.listMessages(email, folder, 1, 50);
        for (const msg of data) {
          if (msg.threadId === threadId || msg.messageId === threadId) {
            const detail = await this.getMessage(email, folder, msg.uid);
            matchingMessages.push(detail);
            participantsMap.set(detail.from.address, detail.from.name);
            detail.to.forEach((t) => participantsMap.set(t.address, t.name));
          }
        }
      } catch (_) {}
    }

    matchingMessages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      threadId,
      subject: matchingMessages[0]?.subject || '(no subject)',
      messages: matchingMessages,
      participants: Array.from(participantsMap.entries()).map(([address, name]) => ({
        name: name || address,
        address,
      })),
      messageCount: matchingMessages.length,
    };
  }

  /**
   * Update message flags
   */
  async updateFlags(
    email: string,
    folder: string,
    uids: number[],
    flags: string[],
    action: 'add' | 'remove' | 'set',
  ): Promise<void> {
    const client = this.createClient(email);
    await client.connect();

    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const uidRange = uids.join(',');
        if (action === 'add') {
          await client.messageFlagsAdd(uidRange, flags, { uid: true });
        } else if (action === 'remove') {
          await client.messageFlagsRemove(uidRange, flags, { uid: true });
        } else if (action === 'set') {
          await client.messageFlagsSet(uidRange, flags, { uid: true });
        }
        await this.invalidateFoldersCache(email);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Move messages between folders
   */
  async moveMessages(
    email: string,
    sourceFolder: string,
    destinationFolder: string,
    uids: number[],
  ): Promise<void> {
    const client = this.createClient(email);
    await client.connect();

    try {
      const lock = await client.getMailboxLock(sourceFolder);
      try {
        const uidRange = uids.join(',');
        await client.messageMove(uidRange, destinationFolder, { uid: true });
        await this.invalidateFoldersCache(email);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Delete messages
   */
  async deleteMessages(
    email: string,
    folder: string,
    uids: number[],
    permanent = false,
  ): Promise<void> {
    const client = this.createClient(email);
    await client.connect();

    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const uidRange = uids.join(',');
        if (permanent || folder.toLowerCase() === 'trash') {
          await client.messageDelete(uidRange, { uid: true });
        } else {
          // Move to Trash
          await client.messageMove(uidRange, 'Trash', { uid: true });
        }
        await this.invalidateFoldersCache(email);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Save a draft message to the IMAP Drafts folder
   */
  async saveDraft(email: string, draftData: SaveDraftDto, existingUid?: number): Promise<{ uid: number; folder: string }> {
    const client = this.createClient(email);
    await client.connect();

    try {
      // Build RFC 5322 MIME message for draft
      const to = (draftData.to || []).join(', ');
      const cc = (draftData.cc || []).join(', ');
      const bcc = (draftData.bcc || []).join(', ');
      const subject = draftData.subject || '';
      const body = draftData.htmlBody || draftData.textBody || '';

      const lines = [
        `From: ${email}`,
        to ? `To: ${to}` : '',
        cc ? `Cc: ${cc}` : '',
        bcc ? `Bcc: ${bcc}` : '',
        `Subject: ${subject}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <draft-${Date.now()}@${email.split('@')[1]}>`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        body,
      ].filter((line) => line !== '');

      const mimeBuffer = Buffer.from(lines.join('\r\n'), 'utf-8');

      // If updating existing draft, delete it first
      if (existingUid) {
        try {
          const lock = await client.getMailboxLock('Drafts');
          try {
            await client.messageDelete(existingUid.toString(), { uid: true });
          } finally {
            lock.release();
          }
        } catch (_) {}
      }

      // Append draft to Drafts folder
      const appendResult: any = await client.append('Drafts', mimeBuffer, ['\\Draft', '\\Seen']);
      await this.invalidateFoldersCache(email);

      return {
        uid: (appendResult && appendResult.uid) ? appendResult.uid : 1,
        folder: 'Drafts',
      };
    } finally {
      await client.logout();
    }
  }

  /**
   * Search messages with operators (from:, to:, subject:, is:unread, is:starred, etc.)
   */
  async searchMessages(
    email: string,
    queryStr: string,
    folder = 'INBOX',
    page = 1,
    pageSize = 50,
  ) {
    const client = this.createClient(email);
    await client.connect();

    try {
      const lock = await client.getMailboxLock(folder);
      try {
        // Parse search query operators
        const searchCriteria: any = {};
        const terms: string[] = [];

        const tokens = queryStr.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        for (const token of tokens) {
          const colonIdx = token.indexOf(':');
          if (colonIdx !== -1) {
            const key = token.substring(0, colonIdx).toLowerCase();
            const val = token.substring(colonIdx + 1).replace(/^"|"$/g, '');

            if (key === 'from') searchCriteria.from = val;
            else if (key === 'to') searchCriteria.to = val;
            else if (key === 'subject') searchCriteria.subject = val;
            else if (key === 'label') searchCriteria.keyword = `MailHive_${val}`;
            else if (key === 'is') {
              if (val === 'unread') searchCriteria.unseen = true;
              else if (val === 'read') searchCriteria.seen = true;
              else if (val === 'starred') searchCriteria.flagged = true;
            } else if (key === 'before') {
              searchCriteria.before = new Date(val);
            } else if (key === 'after') {
              searchCriteria.since = new Date(val);
            }
          } else {
            terms.push(token);
          }
        }

        if (terms.length > 0) {
          searchCriteria.body = terms.join(' ');
        }

        // Perform IMAP search
        const searchUids = await client.search(searchCriteria, { uid: true });
        if (!searchUids || searchUids.length === 0) {
          return { data: [], total: 0, page, pageSize, totalPages: 0 };
        }

        // Reverse to show newest first
        searchUids.reverse();
        const total = searchUids.length;
        const totalPages = Math.ceil(total / pageSize);
        const pageUids = searchUids.slice((page - 1) * pageSize, page * pageSize);

        const results: MessageListItemDto[] = [];
        if (pageUids.length > 0) {
          for await (const msg of client.fetch(pageUids.join(','), {
            uid: true,
            envelope: true,
            flags: true,
            bodyStructure: true,
            internalDate: true,
            size: true,
          }, { uid: true })) {
            const flags = Array.from(msg.flags || []);
            const fromAddr = msg.envelope?.from?.[0] || { name: '', address: '' };
            const toAddrs = (msg.envelope?.to || []).map((t: any) => ({
              name: t.name || '',
              address: t.address || '',
            }));

            results.push({
              uid: msg.uid,
              messageId: msg.envelope?.messageId || `<${msg.uid}@local>`,
              threadId: msg.envelope?.inReplyTo || msg.envelope?.messageId || `<${msg.uid}@local>`,
              from: { name: fromAddr.name || fromAddr.address || '', address: fromAddr.address || '' },
              to: toAddrs,
              subject: msg.envelope?.subject || '(no subject)',
              snippet: '',
              date: new Date(msg.envelope?.date || msg.internalDate || Date.now()).toISOString(),
              flags,
              isRead: flags.includes('\\Seen'),
              isStarred: flags.includes('\\Flagged'),
              hasAttachments: this.checkHasAttachments(msg.bodyStructure),
              labels: flags.filter((flag) => flag.startsWith('MailHive_')).map((flag) => flag.slice(9)),
              size: msg.size || 0,
            });
          }
        }

        return {
          data: results,
          total,
          page,
          pageSize,
          totalPages,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Download a specific attachment by partId / contentId or filename
   */
  async getAttachment(email: string, folder = 'INBOX', uid: number, partId: string) {
    const client = this.createClient(email);
    await client.connect();

    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const downloadResult = await client.download(uid.toString(), undefined, { uid: true });
        if (!downloadResult || !downloadResult.content) {
          throw new NotFoundException(`Message ${uid} not found`);
        }

        const parsed = await simpleParser(downloadResult.content);
        const attachment = (parsed.attachments || []).find(
          (att, idx) => att.contentId === partId || `part-${idx + 1}` === partId || att.filename === partId,
        );

        if (!attachment) {
          throw new NotFoundException(`Attachment ${partId} not found`);
        }

        return {
          buffer: attachment.content,
          contentType: attachment.contentType || 'application/octet-stream',
          filename: attachment.filename || 'attachment',
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Listen to real-time mailbox events via IMAP IDLE
   */
  listenMailboxEvents(
    email: string,
    onEvent: (event: { type: string; data: any }) => void,
  ): () => void {
    const client = this.createClient(email);
    let active = true;

    (async () => {
      try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        client.on('exists', (data) => {
          if (!active) return;
          this.logger.debug(`[IDLE] New mail in INBOX for ${email}: count ${data.count}`);
          onEvent({ type: 'new_mail', data: { count: data.count, prevCount: data.prevCount } });
        });

        client.on('expunge', (data) => {
          if (!active) return;
          this.logger.debug(`[IDLE] Message expunged for ${email}: seq ${data.seq}`);
          onEvent({ type: 'expunge', data });
        });

        client.on('flags', (data) => {
          if (!active) return;
          this.logger.debug(`[IDLE] Flags updated for ${email}: uid ${data.uid}`);
          onEvent({ type: 'flags_updated', data });
        });

        // Run IMAP IDLE loop
        while (active) {
          try {
            await client.idle();
          } catch (idleErr) {
            if (!active) break;
            this.logger.debug(`IMAP IDLE cycle interrupted: ${idleErr.message}`);
          }
        }

        lock.release();
      } catch (err) {
        this.logger.error(`Error in IMAP IDLE for ${email}: ${err.message}`);
      }
    })();

    // Return cleanup function
    return () => {
      active = false;
      client.logout().catch(() => {});
    };
  }
}
