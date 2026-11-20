'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  Paperclip,
  Trash2,
  Send,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTo?: string;
  initialSubject?: string;
  initialInReplyTo?: string;
  onSent?: () => void;
}

export function ComposeModal({
  isOpen,
  onClose,
  initialTo = '',
  initialSubject = '',
  initialInReplyTo = '',
  onSent,
}: ComposeModalProps) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [draftUid, setDraftUid] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Autocomplete suggestions
  const [contactQuery, setContactQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ email: string; displayName?: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial props
  useEffect(() => {
    if (initialTo) setTo(initialTo);
    if (initialSubject) setSubject(initialSubject);
  }, [initialTo, initialSubject]);

  // Autocomplete contacts lookup
  useEffect(() => {
    if (!contactQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await api.getContacts(contactQuery);
        setSuggestions(data.contacts || []);
        setShowSuggestions((data.contacts || []).length > 0);
      } catch (_) {}
    }, 200);

    return () => clearTimeout(timer);
  }, [contactQuery]);

  // Autosave drafts every 20 seconds if subject or body entered
  useEffect(() => {
    if (!isOpen || (!subject && !body && !to)) return;

    const timer = setTimeout(async () => {
      try {
        setSaveStatus('Saving draft...');
        const toList = to ? to.split(',').map((s) => s.trim()).filter(Boolean) : [];
        const res = await api.saveDraft(
          {
            to: toList,
            subject: subject || 'Untitled draft',
            htmlBody: body ? `<p>${body.replace(/\n/g, '<br>')}</p>` : '',
            textBody: body,
          },
          draftUid || undefined,
        );
        if (res && res.uid) {
          setDraftUid(res.uid);
          setSaveStatus('Saved');
        }
      } catch (_) {
        setSaveStatus('');
      }
    }, 20000);

    return () => clearTimeout(timer);
  }, [to, subject, body, isOpen, draftUid]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      alert('Please enter at least one recipient in the To field.');
      return;
    }

    setSending(true);
    try {
      const toAddresses = to.split(',').map((s) => s.trim()).filter(Boolean);
      const ccAddresses = cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const bccAddresses = bcc ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

      await api.sendMail({
        to: toAddresses,
        cc: ccAddresses,
        bcc: bccAddresses,
        subject: subject || '(no subject)',
        htmlBody: body ? `<p>${body.replace(/\n/g, '<br>')}</p>` : '',
        textBody: body,
        inReplyTo: initialInReplyTo || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Clear draft if it existed
      if (draftUid) {
        api.deleteMessages('Drafts', [draftUid], true).catch(() => {});
      }

      onClose();
      if (onSent) onSent();
    } catch (err: any) {
      alert(`Failed to send email: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  return (
    <div
      className={`fixed bottom-0 right-8 z-50 bg-background border border-border shadow-2xl rounded-t-2xl flex flex-col transition-all duration-150 ${
        minimized
          ? 'w-72 h-11'
          : maximized
            ? 'w-[90vw] h-[85vh] right-5'
            : 'w-[560px] h-[520px]'
      }`}
    >
      {/* Header Bar */}
      <div
        className="h-11 px-4 bg-secondary/80 rounded-t-2xl border-b border-border flex items-center justify-between select-none cursor-pointer"
        onClick={() => minimized && setMinimized(false)}
      >
        <span className="text-xs font-semibold text-foreground truncate">
          {subject ? subject : 'New Message'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(!minimized);
            }}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMaximized(!maximized);
              setMinimized(false);
            }}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body Area (visible when not minimized) */}
      {!minimized && (
        <form onSubmit={handleSend} className="flex-1 flex flex-col overflow-hidden">
          {/* Header Inputs */}
          <div className="border-b border-border divide-y divide-border/60 text-sm">
            {/* To field with Autocomplete */}
            <div className="px-4 py-2 flex items-center gap-2 relative">
              <span className="text-xs font-medium text-muted-foreground w-12">To</span>
              <input
                type="text"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setContactQuery(e.target.value.split(',').pop()?.trim() || '');
                }}
                placeholder="Recipients (comma separated)"
                className="flex-1 bg-transparent focus:outline-none text-foreground text-sm"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="hover:text-foreground"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="hover:text-foreground"
                  >
                    Bcc
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && (
                <div className="absolute top-10 left-16 right-4 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                  {suggestions.map((c) => (
                    <button
                      key={c.email}
                      type="button"
                      onClick={() => {
                        const parts = to.split(',');
                        parts.pop();
                        parts.push(c.email);
                        setTo(parts.join(', ') + ', ');
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-secondary text-xs flex items-center justify-between"
                    >
                      <span className="font-medium text-foreground">{c.displayName || c.email}</span>
                      <span className="text-muted-foreground">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CC */}
            {showCc && (
              <div className="px-4 py-2 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground w-12">Cc</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Cc recipients"
                  className="flex-1 bg-transparent focus:outline-none text-foreground text-sm"
                />
              </div>
            )}

            {/* BCC */}
            {showBcc && (
              <div className="px-4 py-2 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground w-12">Bcc</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Bcc recipients"
                  className="flex-1 bg-transparent focus:outline-none text-foreground text-sm"
                />
              </div>
            )}

            {/* Subject */}
            <div className="px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-12">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent focus:outline-none text-foreground font-medium text-sm"
              />
            </div>
          </div>

          {/* Editor Body */}
          <div className="flex-1 p-4 flex flex-col overflow-y-auto">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here..."
              className="flex-1 w-full bg-transparent resize-none focus:outline-none text-sm text-foreground leading-relaxed min-h-[160px]"
            />

            {/* Attachment Chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-xs text-foreground"
                  >
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-0.5 hover:text-destructive rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="h-14 px-4 border-t border-border bg-secondary/20 flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-all"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              {saveStatus && (
                <span className="text-[11px] text-muted-foreground italic">{saveStatus}</span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Discard draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
