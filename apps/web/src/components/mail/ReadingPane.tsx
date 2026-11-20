"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import DOMPurify from "dompurify";
import {
  ArrowLeft,
  Archive,
  Trash2,
  Mail,
  Reply,
  ReplyAll,
  Forward,
  Download,
  FileText,
  ChevronDown,
  Image as ImageIcon,
  Star,
  ShieldCheck,
} from "lucide-react";
import { api, MessageDetail } from "@/lib/api";
import { IconButton } from "@/components/ui/mail-ui";

interface ReadingPaneProps {
  message: MessageDetail | null;
  loading: boolean;
  folder: string;
  onBack: () => void;
  onArchive: (uid: number) => void;
  onDelete: (uid: number) => void;
  onMarkUnread: (uid: number) => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onToggleStar: (uid: number) => void;
  onShowRaw: (uid: number) => void;
  onTrustSender?: (email: string) => Promise<void>;
}

export function ReadingPane({
  message,
  loading,
  folder,
  onBack,
  onArchive,
  onDelete,
  onMarkUnread,
  onReply,
  onReplyAll,
  onForward,
  onToggleStar,
  onShowRaw,
  onTrustSender,
}: ReadingPaneProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [displayRemoteImages, setDisplayRemoteImages] = useState(false);
  const [error, setError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setShowDetails(false);
    setDisplayRemoteImages(false);
    setError("");
    if (!loading) headingRef.current?.focus();
  }, [message?.uid, folder, loading]);

  const senderAddress = message?.from.address;
  useEffect(() => {
    let canceled = false;
    setDisplayRemoteImages(false);
    if (senderAddress)
      void api
        .getTrustedSenders()
        .then((result: { senders: Array<{ email: string }> }) => {
          if (
            !canceled &&
            result.senders.some(
              (sender) =>
                sender.email.toLowerCase() === senderAddress.toLowerCase(),
            )
          )
            setDisplayRemoteImages(true);
        })
        .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [senderAddress, message?.uid]);

  const email = useMemo(() => {
    if (!message || typeof window === "undefined")
      return { html: "", remote: false };
    const text = message.textBody.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
    const clean = DOMPurify.sanitize(message.htmlBody || `<pre>${text}</pre>`, {
      FORBID_TAGS: [
        "form",
        "input",
        "button",
        "textarea",
        "select",
        "iframe",
        "object",
        "embed",
        "style",
      ],
      FORBID_ATTR: ["srcset"],
    });
    const doc = new DOMParser().parseFromString(clean, "text/html");
    let remote = false;
    doc.querySelectorAll("img").forEach((img) => {
      const src =
        img.getAttribute("src") ||
        img.getAttribute("data-remote-src") ||
        img.getAttribute("data-original-src") ||
        "";
      if (/^(https?:)?\/\//i.test(src)) {
        remote = true;
        if (!displayRemoteImages) {
          const placeholder = doc.createElement("span");
          placeholder.textContent = img.alt || "Image hidden";
          placeholder.setAttribute(
            "style",
            "display:inline-block;padding:10px 16px;background:#f3f6f7;border:1px solid #e0e6e9;border-radius:8px;color:#52616e;font-size:12px",
          );
          img.replaceWith(placeholder);
        } else {
          img.setAttribute("src", src);
        }
      }
    });
    doc.querySelectorAll("a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!/^(https?:|mailto:)/i.test(href)) {
        link.removeAttribute("href");
        return;
      }
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      link.setAttribute("title", href);
      const visible = link.textContent?.trim() || "";
      if (/^https?:\/\//i.test(visible)) {
        try {
          if (new URL(visible).hostname !== new URL(href).hostname) {
            link.setAttribute(
              "title",
              `Link destination differs from its text: ${href}`,
            );
            link.appendChild(
              doc.createTextNode(` [destination: ${new URL(href).hostname}]`),
            );
          }
        } catch {
          /* A mailto link has no web hostname. */
        }
      }
    });
    return { html: doc.body.innerHTML, remote };
  }, [message, displayRemoteImages]);

  if (loading)
    return (
      <section className="mail-surface p-8" role="status">
        <span className="sr-only">Opening message</span>
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-14 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded bg-muted" />
      </section>
    );
  if (!message) return null;
  const formattedDate = new Date(message.date).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const name = message.from.name || message.from.address;
  const source = `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:${displayRemoteImages ? " https: http:" : ""}; base-uri 'none'; form-action 'none';"><style>body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;color:#263342;background:white;margin:0;padding:2px;overflow-wrap:anywhere}a{color:#16695d}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font:inherit}blockquote{border-left:2px solid #dce4e7;margin:16px 0;padding-left:16px;color:#586571}</style></head><body>${email.html}</body></html>`;
  return (
    <section className="mail-surface" aria-label="Reading message">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3 sm:px-5">
        <div className="flex items-center gap-1">
          <IconButton label="Back to list" onClick={onBack}>
            <ArrowLeft size={20} />
          </IconButton>
          <span className="mx-2 h-5 border-l" />
          <IconButton
            label="Archive (e)"
            onClick={() => onArchive(message.uid)}
          >
            <Archive size={18} />
          </IconButton>
          <IconButton label="Delete (#)" onClick={() => onDelete(message.uid)}>
            <Trash2 size={18} />
          </IconButton>
          <IconButton
            label="Mark as unread"
            onClick={() => onMarkUnread(message.uid)}
          >
            <Mail size={18} />
          </IconButton>
        </div>
        <button
          onClick={() => onShowRaw(message.uid)}
          className="rounded-full px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
        >
          Show original
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-start gap-3">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="min-w-0 flex-1 break-words text-2xl font-normal leading-snug tracking-tight sm:text-[28px]"
            >
              {message.subject || "(no subject)"}
            </h1>
            <IconButton
              label={message.isStarred ? "Unstar message" : "Star message"}
              onClick={() => onToggleStar(message.uid)}
              aria-pressed={message.isStarred}
            >
              <Star
                size={20}
                className={
                  message.isStarred ? "fill-amber-400 text-amber-600" : ""
                }
              />
            </IconButton>
          </div>
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
              {name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="ml-2 hidden text-xs text-muted-foreground lg:inline">
                    &lt;{message.from.address}&gt;
                  </span>
                </div>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={message.date}
                >
                  {formattedDate}
                </time>
              </div>
              <button
                aria-expanded={showDetails}
                onClick={() => setShowDetails(!showDetails)}
                className="mt-1 flex max-w-full items-center gap-1 rounded text-xs text-muted-foreground"
              >
                <span className="truncate">
                  to{" "}
                  {message.to
                    .map((recipient) => recipient.name || recipient.address)
                    .join(", ")}
                </span>
                <ChevronDown size={14} />
              </button>
              {showDetails && (
                <dl className="mt-3 grid grid-cols-[48px_1fr] gap-2 break-all rounded-xl border bg-muted/50 p-4 text-xs">
                  <dt className="text-muted-foreground">From</dt>
                  <dd>{message.from.address}</dd>
                  <dt className="text-muted-foreground">To</dt>
                  <dd>
                    {message.to
                      .map((recipient) => recipient.address)
                      .join(", ")}
                  </dd>
                  {message.cc.length > 0 && (
                    <>
                      <dt className="text-muted-foreground">Cc</dt>
                      <dd>
                        {message.cc
                          .map((recipient) => recipient.address)
                          .join(", ")}
                      </dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Date</dt>
                  <dd>{formattedDate}</dd>
                </dl>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(["dkim", "spf", "dmarc"] as const).map((key) => (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${message.authResults[key] === "pass" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}
                  >
                    {message.authResults[key] === "pass" && (
                      <ShieldCheck size={11} />
                    )}
                    {key.toUpperCase()}: {message.authResults[key]}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {email.remote && !displayRemoteImages && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-secondary/70 px-4 py-3 text-xs">
              <ImageIcon size={17} className="text-muted-foreground" />
              <span className="flex-1 text-muted-foreground">
                Remote images are hidden to protect your privacy.
              </span>
              <button
                onClick={() => setDisplayRemoteImages(true)}
                className="font-medium text-primary hover:underline"
              >
                Display images
              </button>
              {onTrustSender && (
                <button
                  onClick={async () => {
                    try {
                      await onTrustSender(message.from.address);
                      setDisplayRemoteImages(true);
                    } catch {
                      setError(
                        "Couldn’t save the trusted sender. Please try again.",
                      );
                    }
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  Trust sender
                </button>
              )}
            </div>
          )}
          <div className="my-7 rounded-xl bg-white p-4 sm:p-6 dark:border dark:border-border">
            <iframe
              ref={iframeRef}
              srcDoc={source}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              onLoad={() => {
                const height =
                  iframeRef.current?.contentDocument?.body.scrollHeight || 250;
                if (iframeRef.current)
                  iframeRef.current.style.height = `${Math.max(250, height + 20)}px`;
              }}
              className="min-h-[250px] w-full border-0"
              title="Email Content"
            />
          </div>
          {!!message.attachments.length && (
            <div className="mb-8 border-t pt-5">
              <h2 className="mb-3 text-sm font-medium">
                {message.attachments.length} attachment
                {message.attachments.length === 1 ? "" : "s"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {message.attachments.map((attachment) => (
                  <button
                    key={attachment.partId}
                    onClick={async () => {
                      try {
                        await api.downloadAttachment(
                          message.uid,
                          attachment.partId,
                          folder,
                          attachment.filename,
                        );
                      } catch {
                        setError(
                          "Couldn’t download the attachment. Please try again.",
                        );
                      }
                    }}
                    className="flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left hover:bg-muted"
                  >
                    <FileText size={26} className="shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {attachment.filename}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {(attachment.size / 1024).toFixed(1)} KB
                      </span>
                    </span>
                    <Download size={16} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3 pb-8">
            {[
              { label: "Reply", icon: Reply, action: onReply },
              { label: "Reply all", icon: ReplyAll, action: onReplyAll },
              { label: "Forward", icon: Forward, action: onForward },
            ].map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex min-h-10 items-center gap-2 rounded-full border border-input px-5 text-sm font-medium hover:bg-secondary"
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
