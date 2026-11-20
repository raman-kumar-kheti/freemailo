'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Archive,
  Trash2,
  AlertOctagon,
  Mail,
  Reply,
  ReplyAll,
  Forward,
  Download,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { MessageDetail } from '@/lib/api';

interface ReadingPaneProps {
  message: MessageDetail | null;
  loading: boolean;
  onBack: () => void;
  onArchive: (uid: number) => void;
  onDelete: (uid: number) => void;
  onMarkUnread: (uid: number) => void;
  onReply: (to: string, subject: string, inReplyTo: string) => void;
  onShowRaw: (uid: number) => void;
  onTrustSender?: (email: string) => void;
}

export function ReadingPane({
  message,
  loading,
  onBack,
  onArchive,
  onDelete,
  onMarkUnread,
  onReply,
  onShowRaw,
  onTrustSender,
}: ReadingPaneProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [displayRemoteImages, setDisplayRemoteImages] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Format date
  const formattedDate = message?.date ? new Date(message.date).toLocaleString() : '';

  // Resize iframe when content loads
  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const height = iframeRef.current.contentWindow.document.body.scrollHeight;
        iframeRef.current.style.height = `${Math.max(height + 20, 200)}px`;
      } catch (_) {}
    }
  };

  // Modify HTML to toggle remote images if requested
  const getProcessedHtml = () => {
    if (!message) return '';
    let html = message.htmlBody || `<pre>${message.textBody}</pre>`;

    // If remote images are blocked, replace src="http..." with placeholder data attribute
    if (!displayRemoteImages) {
      html = html.replace(
        /<img([^>]*)\ssrc=["'](https?:\/\/[^"']+)["']([^>]*)>/gi,
        '<div class="remote-image-blocked" style="border:1px dashed #cbd5e1;padding:8px;margin:4px 0;display:inline-block;font-size:12px;color:#64748b;border-radius:4px;">[Remote Image Blocked]</div>',
      );
    }
    return html;
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-12 bg-muted rounded w-full" />
        <div className="h-64 bg-muted rounded w-full" />
      </div>
    );
  }

  if (!message) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto bg-background">
      {/* Top Action Toolbar */}
      <div className="h-12 border-b border-border px-4 flex items-center justify-between text-muted-foreground bg-secondary/30 sticky top-0 z-20 select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-secondary hover:text-foreground transition-colors mr-2"
            title="Back to list (k / esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onArchive(message.uid)}
            className="p-1.5 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
            title="Archive (e)"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(message.uid)}
            className="p-1.5 rounded-lg hover:bg-secondary hover:text-destructive transition-colors"
            title="Delete (#)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMarkUnread(message.uid)}
            className="p-1.5 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
            title="Mark as unread"
          >
            <Mail className="w-4 h-4" />
          </button>
        </div>

        <div>
          <button
            onClick={() => onShowRaw(message.uid)}
            className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-secondary transition-colors"
            title="View Raw Headers & Source"
          >
            Show original
          </button>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Subject */}
        <h1 className="text-xl font-bold text-foreground leading-tight">
          {message.subject || '(no subject)'}
        </h1>

        {/* Sender Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-sm text-sm">
              {(message.from.name || message.from.address).substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">
                  {message.from.name || message.from.address}
                </span>
                <span className="text-xs text-muted-foreground">
                  &lt;{message.from.address}&gt;
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  to {message.to.map((t) => t.name || t.address).join(', ')}
                  {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Expandable Details Dropdown */}
              {showDetails && (
                <div className="mt-3 p-3 bg-secondary/50 rounded-lg text-xs space-y-1.5 border border-border">
                  <div>
                    <span className="text-muted-foreground">From:</span> {message.from.name} &lt;{message.from.address}&gt;
                  </div>
                  <div>
                    <span className="text-muted-foreground">To:</span> {message.to.map((t) => `${t.name} <${t.address}>`).join(', ')}
                  </div>
                  {message.cc.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Cc:</span> {message.cc.map((c) => `${c.name} <${c.address}>`).join(', ')}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Date:</span> {formattedDate}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Security:</span> Standard Encryption (TLS)
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>

            {/* Authentication Badges (SPF / DKIM / DMARC) */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  message.authResults.dkim === 'pass'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}
                title={`DKIM: ${message.authResults.dkim}`}
              >
                DKIM: {message.authResults.dkim}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  message.authResults.spf === 'pass'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}
                title={`SPF: ${message.authResults.spf}`}
              >
                SPF: {message.authResults.spf}
              </span>
            </div>
          </div>
        </div>

        {/* Remote Images Privacy Notice */}
        {!displayRemoteImages && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Images are blocked to prevent email senders from tracking you.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDisplayRemoteImages(true)}
                className="font-semibold underline hover:no-underline"
              >
                Display images
              </button>
              {onTrustSender && (
                <button
                  onClick={() => onTrustSender(message.from.address)}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Always trust sender
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sandboxed HTML Email Rendering */}
        <div className="border border-border/80 rounded-xl p-4 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
          <iframe
            ref={iframeRef}
            srcDoc={`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta http-equiv="Content-Security-Policy" content="script-src 'none'; default-src 'self' data: https:;">
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                      font-size: 14px;
                      line-height: 1.6;
                      color: #1e293b;
                      margin: 0;
                      padding: 4px;
                    }
                    @media (prefers-color-scheme: dark) {
                      body { color: #f1f5f9; }
                    }
                    a { color: #2563eb; text-decoration: underline; }
                    img { max-width: 100%; height: auto; }
                  </style>
                </head>
                <body>${getProcessedHtml()}</body>
              </html>
            `}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            onLoad={handleIframeLoad}
            className="w-full border-0 min-h-[180px]"
            title="Email Content"
          />
        </div>

        {/* Attachments Section */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Attachments ({message.attachments.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {message.attachments.map((att) => (
                <a
                  key={att.partId}
                  href={`/api/mail/attachments/${message.uid}/${encodeURIComponent(att.partId)}`}
                  download={att.filename}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary transition-colors group"
                >
                  <FileText className="w-6 h-6 text-blue-600 flex-shrink-0" />
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{att.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(att.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Reply Bar */}
        <div className="pt-6 border-t border-border flex items-center gap-3">
          <button
            onClick={() => onReply(message.from.address, `Re: ${message.subject}`, message.messageId)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          <button
            onClick={() => onReply(message.from.address, `Fwd: ${message.subject}`, message.messageId)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Forward className="w-4 h-4" />
            Forward
          </button>
        </div>
      </div>
    </div>
  );
}
