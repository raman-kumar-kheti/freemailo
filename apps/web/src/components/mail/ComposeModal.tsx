"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  Paperclip,
  Trash2,
  Send,
  Loader2,
  Bold,
  Italic,
  Underline,
  List,
  Link as LinkIcon,
  Undo2,
  Check,
  PenLine,
} from "lucide-react";
import { api } from "@/lib/api";
import { IconButton } from "@/components/ui/mail-ui";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTo?: string;
  initialSubject?: string;
  initialInReplyTo?: string;
  initialBody?: string;
  initialHtml?: string;
  initialCc?: string;
  initialBcc?: string;
  existingDraftUid?: number;
  onSent?: () => void;
}
const splitAddresses = (value: string) =>
  value
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export function ComposeModal({
  isOpen,
  onClose,
  initialTo = "",
  initialSubject = "",
  initialInReplyTo = "",
  initialBody = "",
  initialHtml,
  initialCc = "",
  initialBcc = "",
  existingDraftUid,
  onSent,
}: ComposeModalProps) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [bcc, setBcc] = useState(initialBcc);
  const [showCc, setShowCc] = useState(!!initialCc);
  const [showBcc, setShowBcc] = useState(!!initialBcc);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [html, setHtml] = useState(
    initialHtml ||
      (initialBody
        ? `<p>${escapeHtml(initialBody).replace(/\n/g, "<br>")}</p>`
        : ""),
  );
  const [attachments, setAttachments] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{ email: string; displayName?: string }>
  >([]);
  const [signatures, setSignatures] = useState<
    Array<{ id: string; name: string; body: string }>
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const draftUid = useRef<number | undefined>(existingDraftUid);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const busyRef = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        link: { openOnClick: false },
      }),
    ],
    immediatelyRender: false,
    content: html,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Message body",
        "aria-multiline": "true",
        "data-placeholder": "Write your message…",
        class: "mail-editor min-h-[160px] outline-none text-sm leading-7",
      },
    },
    onUpdate: ({ editor: current }) => {
      setHtml(current.getHTML());
      setBody(current.getText());
      setSaveStatus("");
    },
  });
  useEffect(() => {
    editor?.setEditable(!busy);
  }, [editor, busy]);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    toRef.current?.focus();
    void api
      .getSignatures()
      .then((result) => setSignatures(result.signatures || []))
      .catch(() => {});
    return () => previousFocus.current?.focus();
  }, []);
  useEffect(() => {
    const query = to.split(",").pop()?.trim();
    if (!query) {
      setSuggestions([]);
      return;
    }
    let canceled = false;
    const timer = setTimeout(() => {
      void api
        .getContacts(query)
        .then((result) => {
          if (!canceled) setSuggestions(result.contacts || []);
        })
        .catch(() => {});
    }, 200);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [to]);
  const saveDraft = useCallback(() => {
    if (!to && !subject && !body && !cc && !bcc) return saveQueue.current;
    const payload = {
      to: splitAddresses(to),
      cc: splitAddresses(cc),
      bcc: splitAddresses(bcc),
      subject,
      htmlBody: html,
      textBody: body,
    };
    const operation = saveQueue.current
      .catch(() => {})
      .then(async () => {
        setSaveStatus("Saving…");
        const result = await api.saveDraft(payload, draftUid.current);
        draftUid.current = result.uid;
        setSaveStatus("Saved to Drafts");
      });
    saveQueue.current = operation;
    return operation;
  }, [to, cc, bcc, subject, html, body]);
  useEffect(() => {
    if (busy) return;
    const timer = setTimeout(() => {
      if (!busyRef.current)
        void saveDraft().catch(() => setSaveStatus("Couldn’t save draft"));
    }, 2000);
    return () => clearTimeout(timer);
  }, [saveDraft, busy]);
  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (
        (to || subject || body) &&
        (attachments.length || saveStatus !== "Saved to Drafts")
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [to, subject, body, saveStatus, attachments.length]);
  const beginBusy = () => {
    busyRef.current = true;
    setBusy(true);
    setError("");
  };
  const endBusy = () => {
    busyRef.current = false;
    setBusy(false);
    setSending(false);
  };
  const closeAndSave = async () => {
    if (busyRef.current) return;
    beginBusy();
    try {
      await saveDraft();
      if (attachments.length) setMinimized(true);
      else onClose();
    } catch {
      setError(
        "Your draft couldn’t be saved. Please try again before closing.",
      );
    } finally {
      endBusy();
    }
  };
  const discard = async () => {
    if (busyRef.current) return;
    beginBusy();
    try {
      await saveQueue.current.catch(() => {});
      if (draftUid.current)
        await api.deleteMessages("Drafts", [draftUid.current], true);
      onClose();
    } catch {
      setError("Couldn’t discard your saved draft. Please try again.");
    } finally {
      endBusy();
    }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    const addresses = [
      ...splitAddresses(to),
      ...splitAddresses(cc),
      ...splitAddresses(bcc),
    ];
    if (
      !splitAddresses(to).length ||
      addresses.some((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    ) {
      setError("Enter valid email addresses, separated by commas.");
      toRef.current?.focus();
      return;
    }
    beginBusy();
    setSending(true);
    try {
      await saveQueue.current.catch(() => {});
      await api.sendMail({
        to: splitAddresses(to),
        cc: splitAddresses(cc),
        bcc: splitAddresses(bcc),
        subject: subject || "(no subject)",
        htmlBody: html,
        textBody: body,
        inReplyTo: initialInReplyTo || undefined,
        attachments: attachments.length ? attachments : undefined,
      });
      if (draftUid.current)
        await api
          .deleteMessages("Drafts", [draftUid.current], true)
          .catch(() => {});
      onSent?.();
      onClose();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Couldn’t send your message. Your draft is still here.",
      );
    } finally {
      endBusy();
    }
  };
  if (!isOpen) return null;
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="New message"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          void closeAndSave();
        }
        if (event.key === "Tab") {
          const controls = Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), [contenteditable="true"]',
            ) || [],
          ).filter((element) => element.offsetParent !== null);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
      className={`fixed z-40 flex flex-col overflow-hidden border bg-card shadow-[0_8px_60px_-12px_rgba(0,0,0,0.35)] ${minimized ? "bottom-0 right-4 h-14 w-72 rounded-t-xl" : maximized ? "inset-3 rounded-xl sm:inset-10 lg:inset-x-[15%]" : "inset-0 sm:inset-auto sm:bottom-0 sm:right-8 sm:h-[min(640px,calc(100dvh-100px))] sm:w-[580px] sm:rounded-t-xl"}`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between bg-secondary/70 px-4">
        <button
          onClick={() => setMinimized(false)}
          className="flex min-w-0 items-center gap-2.5 rounded text-sm font-medium"
        >
          <PenLine size={16} className="text-primary" />
          <span className="truncate">
            {minimized ? subject || "New message" : "New message"}
          </span>
        </button>
        <div className="flex items-center">
          <IconButton
            label={minimized ? "Expand compose" : "Minimize"}
            onClick={() => setMinimized(!minimized)}
            disabled={busy}
          >
            {minimized ? <Maximize2 size={15} /> : <Minus size={17} />}
          </IconButton>
          <IconButton
            label={maximized ? "Restore" : "Maximize"}
            onClick={() => {
              setMaximized(!maximized);
              setMinimized(false);
            }}
            disabled={busy}
            className="hidden sm:flex"
          >
            {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </IconButton>
          <IconButton
            label="Save and close"
            onClick={() => void closeAndSave()}
            disabled={busy}
          >
            <X size={18} />
          </IconButton>
        </div>
      </div>
      <form
        onSubmit={send}
        className={`${minimized ? "hidden" : "flex"} min-h-0 flex-1 flex-col`}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy)
            setAttachments((previous) => [
              ...previous,
              ...Array.from(event.dataTransfer.files),
            ]);
        }}
      >
        <fieldset disabled={busy} className="contents">
          <div className="mx-5 flex min-h-12 items-center gap-3 border-b">
            <label
              htmlFor="compose-to"
              className="w-8 text-sm text-muted-foreground"
            >
              To
            </label>
            <input
              ref={toRef}
              id="compose-to"
              required
              value={to}
              onChange={(event) => setTo(event.target.value)}
              list="mail-contacts"
              placeholder="Recipients (comma separated)"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
              autoComplete="off"
            />
            <datalist id="mail-contacts">
              {suggestions.map((contact) => (
                <option
                  key={contact.email}
                  value={[...to.split(",").slice(0, -1), contact.email].join(
                    ", ",
                  )}
                >
                  {contact.displayName}
                </option>
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => setShowCc(!showCc)}
              aria-expanded={showCc}
              className="p-1 text-xs text-muted-foreground"
            >
              Cc
            </button>
            <button
              type="button"
              onClick={() => setShowBcc(!showBcc)}
              aria-expanded={showBcc}
              className="p-1 text-xs text-muted-foreground"
            >
              Bcc
            </button>
          </div>
          {showCc && (
            <label className="mx-5 flex min-h-11 items-center gap-3 border-b text-sm">
              <span className="w-8 text-muted-foreground">Cc</span>
              <input
                value={cc}
                onChange={(event) => setCc(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-3 outline-none"
              />
            </label>
          )}
          {showBcc && (
            <label className="mx-5 flex min-h-11 items-center gap-3 border-b text-sm">
              <span className="w-8 text-muted-foreground">Bcc</span>
              <input
                value={bcc}
                onChange={(event) => setBcc(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-3 outline-none"
              />
            </label>
          )}
          <div className="mx-5 border-b">
            <input
              aria-label="Subject"
              placeholder="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          {error && (
            <p
              role="alert"
              className="mx-5 mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
            >
              {error}
            </p>
          )}
          <div
            className={`relative min-h-0 flex-1 overflow-y-auto px-5 py-4 ${dragging ? "bg-accent ring-2 ring-inset ring-primary" : ""}`}
          >
            <EditorContent editor={editor} />
            {dragging && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/90 text-sm font-medium text-primary">
                Drop files to attach
              </div>
            )}
            {!!attachments.length && (
              <div className="mt-4 space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-1.5 text-xs"
                  >
                    <Paperclip size={14} className="text-primary" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="text-muted-foreground">
                      {Math.ceil(file.size / 1024)} KB
                    </span>
                    <IconButton
                      label={`Remove ${file.name}`}
                      onClick={() =>
                        setAttachments((previous) =>
                          previous.filter((_, position) => position !== index),
                        )
                      }
                      className="h-7 w-7"
                    >
                      <X size={14} />
                    </IconButton>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Keep this window open to retain attachments until you send.
                </p>
              </div>
            )}
          </div>
          <div
            className="mx-5 flex flex-wrap items-center gap-0.5 border-t py-2"
            role="toolbar"
            aria-label="Text formatting"
          >
            <IconButton
              label="Bold"
              aria-pressed={editor?.isActive("bold")}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={
                editor?.isActive("bold") ? "bg-accent text-primary" : ""
              }
            >
              <Bold size={16} />
            </IconButton>
            <IconButton
              label="Italic"
              aria-pressed={editor?.isActive("italic")}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={
                editor?.isActive("italic") ? "bg-accent text-primary" : ""
              }
            >
              <Italic size={16} />
            </IconButton>
            <IconButton
              label="Underline"
              aria-pressed={editor?.isActive("underline")}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <Underline size={16} />
            </IconButton>
            <span className="mx-1 h-4 border-l" />
            <IconButton
              label="Bullet list"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={17} />
            </IconButton>
            <IconButton
              label="Insert link"
              aria-expanded={linkOpen}
              onClick={() => setLinkOpen(!linkOpen)}
            >
              <LinkIcon size={16} />
            </IconButton>
            <IconButton
              label="Undo"
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 size={16} />
            </IconButton>
            {!!signatures.length && (
              <select
                aria-label="Insert signature"
                value=""
                onChange={(event) => {
                  const signature = signatures.find(
                    (item) => item.id === event.target.value,
                  );
                  if (signature)
                    editor
                      ?.chain()
                      .focus()
                      .insertContent(
                        `<p></p>${DOMPurify.sanitize(signature.body)}`,
                      )
                      .run();
                }}
                className="ml-auto max-w-28 rounded bg-transparent p-2 text-xs"
              >
                <option value="" disabled>
                  Signature
                </option>
                {signatures.map((signature) => (
                  <option key={signature.id} value={signature.id}>
                    {signature.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {linkOpen && (
            <div className="flex items-center gap-2 border-t px-5 py-2">
              <input
                aria-label="Link URL"
                placeholder="https://example.com"
                type="url"
                className="field"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
              />
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (/^https?:\/\//i.test(linkUrl)) {
                    editor?.chain().focus().setLink({ href: linkUrl }).run();
                    setLinkOpen(false);
                    setLinkUrl("");
                  } else setError("Links must start with https:// or http://.");
                }}
              >
                Add
              </button>
            </div>
          )}
        </fieldset>
        <div className="flex min-h-[72px] shrink-0 items-center gap-2 border-t px-5 pb-[env(safe-area-inset-bottom)]">
          <button
            type="submit"
            disabled={busy}
            className="primary-button min-w-[108px]"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {sending ? "Sending…" : "Send"}
          </button>
          <IconButton
            label="Attach files"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Paperclip size={20} />
          </IconButton>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              setAttachments((previous) => [
                ...previous,
                ...Array.from(event.target.files || []),
              ]);
              event.target.value = "";
            }}
          />
          <span
            role="status"
            className="ml-1 flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            {saveStatus === "Saved to Drafts" && <Check size={13} />}
            <span className="hidden sm:inline">{saveStatus}</span>
          </span>
          <IconButton
            label="Discard draft"
            onClick={() => void discard()}
            disabled={busy}
            className="ml-auto"
          >
            <Trash2 size={18} />
          </IconButton>
        </div>
      </form>
    </div>
  );
}
