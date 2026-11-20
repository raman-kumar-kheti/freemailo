"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MessageList } from "@/components/mail/MessageList";
import { ReadingPane } from "@/components/mail/ReadingPane";
import dynamic from "next/dynamic";
const ComposeModal = dynamic(
  () =>
    import("@/components/mail/ComposeModal").then(
      (module) => module.ComposeModal,
    ),
  { ssr: false },
);
import { ShortcutsModal } from "@/components/mail/ShortcutsModal";
import { SettingsModal } from "@/components/mail/SettingsModal";
import { IconButton, Modal } from "@/components/ui/mail-ui";
import {
  api,
  User,
  Folder,
  Label,
  MessageListItem,
  MessageDetail,
} from "@/lib/api";
import { CheckCircle2, AlertCircle, Mail, WifiOff, X } from "lucide-react";

type ComposeInitial = {
  to?: string;
  subject?: string;
  inReplyTo?: string;
  body?: string;
  html?: string;
  cc?: string;
  bcc?: string;
  draftUid?: number;
};
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

export default function MailboxApp() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [currentFolder, setCurrentFolder] = useState("INBOX");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedUids, setSelectedUids] = useState<number[]>([]);
  const [activeMessage, setActiveMessage] = useState<MessageDetail | null>(
    null,
  );
  const [loadingActiveMessage, setLoadingActiveMessage] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial>({});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "labels">(
    "profile",
  );
  const [rawModalContent, setRawModalContent] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const listRequest = useRef(0);
  const messageRequest = useRef(0);
  const lastMessageUid = useRef<number | null>(null);
  const goKey = useRef(0);
  const sourceFolder =
    currentFolder.startsWith("search:") ||
    currentFolder.startsWith("label:") ||
    currentFolder === "STARRED"
      ? "INBOX"
      : currentFolder;
  const query = currentFolder.startsWith("search:")
    ? currentFolder.slice(7)
    : "";
  const title = currentFolder.startsWith("search:")
    ? "Search results"
    : currentFolder.startsWith("label:")
      ? currentFolder.slice(6)
      : currentFolder === "INBOX"
        ? "Inbox"
        : currentFolder === "STARRED"
          ? "Starred"
          : currentFolder === "Junk"
            ? "Spam"
            : folders.find((folder) => folder.path === currentFolder)?.name ||
              currentFolder;
  const notifyError = (error: unknown) =>
    setNotice({ text: errorText(error), error: true });

  useEffect(() => {
    api
      .getMe()
      .then(({ user: me }) => setUser(me))
      .catch(() => router.replace("/login"))
      .finally(() => setAuthChecking(false));
    const updateOnline = () => setOffline(!navigator.onLine);
    updateOnline();
    setCollapsed(localStorage.getItem("mailhive-sidebar") === "collapsed");
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [router]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadFoldersAndLabels = useCallback(async () => {
    try {
      const [folderResult, labelResult] = await Promise.all([
        api.getFolders(),
        api.getLabels(),
      ]);
      setFolders(folderResult.folders || []);
      setLabels(labelResult.labels || []);
    } catch (error) {
      setNotice({
        text: `Couldn’t refresh folders: ${errorText(error)}`,
        error: true,
      });
    }
  }, []);
  const loadMessages = useCallback(async () => {
    const request = ++listRequest.current;
    setLoadingMessages(true);
    setLoadError("");
    try {
      const labelQuery = query.replace(
        /label:("[^"]*"|[^\s]+)/g,
        (_, value: string) => {
          const name = value.replace(/^"|"$/g, "");
          return `label:${labels.find((label) => label.name.toLowerCase() === name.toLowerCase())?.id || "unknown"}`;
        },
      );
      const terms = [
        labelQuery,
        currentFolder === "STARRED" ? "is:starred" : "",
        currentFolder.startsWith("label:")
          ? `label:${labels.find((label) => label.name === currentFolder.slice(6))?.id || "unknown"}`
          : "",
        unreadOnly ? "is:unread" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const result = terms
        ? await api.searchMessages(terms, sourceFolder, page, pageSize)
        : await api.getMessages(sourceFolder, page, pageSize);
      if (request !== listRequest.current) return;
      if (page > 1 && (result.total || 0) <= (page - 1) * pageSize) {
        setPage(Math.max(1, Math.ceil(result.total / pageSize)));
        return;
      }
      setMessages(result.data || []);
      setTotal(result.total || 0);
      setSelectedUids([]);
    } catch (error) {
      if (request === listRequest.current) setLoadError(errorText(error));
    } finally {
      if (request === listRequest.current) setLoadingMessages(false);
    }
  }, [currentFolder, query, sourceFolder, page, unreadOnly, labels]);
  useEffect(() => {
    if (user) void loadFoldersAndLabels();
  }, [user, loadFoldersAndLabels]);
  useEffect(() => {
    if (user) void loadMessages();
    const requestCounter = listRequest;
    return () => {
      requestCounter.current++;
    };
  }, [user, loadMessages]);
  const refresh = useRef(() => {});
  refresh.current = () => {
    void loadFoldersAndLabels();
    void loadMessages();
  };
  useEffect(() => {
    if (!user) return;
    let events: EventSource;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let delay = 1000;
    const connect = () => {
      events = new EventSource("/api/mail/events", { withCredentials: true });
      events.onmessage = (event) => {
        try {
          if (
            ["new_mail", "flags_updated", "expunge"].includes(
              JSON.parse(event.data).type,
            )
          )
            refresh.current();
        } catch {
          /* Ignore keep-alives. */
        }
      };
      events.onopen = () => {
        delay = 1000;
      };
      events.onerror = () => {
        events.close();
        if (stopped) return;
        reconnectTimer = setTimeout(() => {
          void api
            .getMe()
            .then(() => {
              if (!stopped) connect();
            })
            .catch(() => {});
        }, delay);
        delay = Math.min(delay * 2, 30000);
      };
    };
    connect();
    const reconnect = () => refresh.current();
    window.addEventListener("online", reconnect);
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      events.close();
      window.removeEventListener("online", reconnect);
    };
  }, [user]);

  const selectFolder = (folder: string) => {
    ++messageRequest.current;
    setLoadingActiveMessage(false);
    setCurrentFolder(folder);
    setActiveMessage(null);
    setSelectedUids([]);
    setPage(1);
    setUnreadOnly(false);
  };
  const openCompose = (initial: ComposeInitial = {}) => {
    if (!composeOpen) setComposeInitial(initial);
    setComposeOpen(true);
  };
  const backToList = () => {
    ++messageRequest.current;
    setActiveMessage(null);
    setLoadingActiveMessage(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(
          `[data-message-open="${lastMessageUid.current}"]`,
        )
        ?.focus(),
    );
  };
  const handleSelectMessage = async (uid: number) => {
    const request = ++messageRequest.current;
    lastMessageUid.current = uid;
    setLoadingActiveMessage(true);
    try {
      const message = await api.getMessage(uid, sourceFolder);
      if (request !== messageRequest.current) return;
      if (
        sourceFolder ===
        (folders.find((folder) => folder.specialUse === "\\Drafts")?.path ||
          "Drafts")
      ) {
        openCompose({
          to: message.to.map((recipient) => recipient.address).join(", "),
          cc: message.cc.map((recipient) => recipient.address).join(", "),
          bcc: message.bcc.map((recipient) => recipient.address).join(", "),
          subject: message.subject,
          body: message.textBody,
          html: message.htmlBody,
          draftUid: message.uid,
          inReplyTo: message.headers["in-reply-to"],
        });
        return;
      }
      setActiveMessage(message);
      if (!message.isRead) {
        await api.updateFlags(sourceFolder, [uid], ["\\Seen"], "add");
        setMessages((previous) =>
          previous.map((item) =>
            item.uid === uid ? { ...item, isRead: true } : item,
          ),
        );
        void loadFoldersAndLabels();
      }
    } catch (error) {
      if (request === messageRequest.current) notifyError(error);
    } finally {
      if (request === messageRequest.current) setLoadingActiveMessage(false);
    }
  };
  const handleToggleStar = async (uid: number) => {
    const target = messages.find((item) => item.uid === uid) || activeMessage;
    const starred = !target?.isStarred;
    try {
      await api.updateFlags(
        sourceFolder,
        [uid],
        ["\\Flagged"],
        starred ? "add" : "remove",
      );
      setMessages((previous) =>
        previous.map((item) =>
          item.uid === uid ? { ...item, isStarred: starred } : item,
        ),
      );
      setActiveMessage((previous) =>
        previous?.uid === uid ? { ...previous, isStarred: starred } : previous,
      );
      if (currentFolder === "STARRED" && !starred) void loadMessages();
    } catch (error) {
      notifyError(error);
    }
  };
  const handleMove = async (uids: number[], destination: string) => {
    try {
      await api.moveMessages(sourceFolder, destination, uids);
      if (activeMessage && uids.includes(activeMessage.uid)) backToList();
      setNotice({
        text: `${uids.length === 1 ? "Message" : `${uids.length} messages`} moved to ${destination}.`,
      });
      refresh.current();
    } catch (error) {
      notifyError(error);
    }
  };
  const handleArchive = (uids: number[]) =>
    handleMove(
      uids,
      folders.find((folder) => folder.specialUse === "\\Archive")?.path ||
        "Archive",
    );
  const handleDelete = async (uids: number[]) => {
    try {
      await api.deleteMessages(sourceFolder, uids);
      if (activeMessage && uids.includes(activeMessage.uid)) backToList();
      setNotice({
        text: `${uids.length === 1 ? "Message" : `${uids.length} messages`} moved to Trash.`,
      });
      refresh.current();
    } catch (error) {
      notifyError(error);
    }
  };
  const handleMarkRead = async (uids: number[], isRead: boolean) => {
    try {
      await api.updateFlags(
        sourceFolder,
        uids,
        ["\\Seen"],
        isRead ? "add" : "remove",
      );
      setMessages((previous) =>
        previous.map((item) =>
          uids.includes(item.uid) ? { ...item, isRead } : item,
        ),
      );
      if (unreadOnly) void loadMessages();
      void loadFoldersAndLabels();
    } catch (error) {
      notifyError(error);
    }
  };
  const handleLabel = async (uids: number[], label: string) => {
    try {
      const labelId = labels.find((item) => item.name === label)?.id;
      if (!labelId) throw new Error("This label is no longer available.");
      const keyword = `MailHive_${labelId}`;
      await api.updateFlags(sourceFolder, uids, [keyword], "add");
      setNotice({ text: `Label “${label}” applied.` });
      void loadMessages();
    } catch (error) {
      notifyError(error);
    }
  };
  const reply = (mode: "reply" | "all" | "forward") => {
    if (!activeMessage) return;
    const sender = activeMessage.replyTo?.length
      ? activeMessage.replyTo.map((item) => item.address)
      : [activeMessage.from.address];
    const recipients =
      mode === "all"
        ? Array.from(
            new Set([
              ...sender,
              ...activeMessage.to.map((item) => item.address),
              ...activeMessage.cc.map((item) => item.address),
            ]),
          ).filter((email) => email.toLowerCase() !== user?.email.toLowerCase())
        : sender;
    openCompose({
      to: mode === "forward" ? "" : recipients.join(", "),
      subject: `${mode === "forward" ? "Fwd" : "Re"}: ${activeMessage.subject.replace(/^(Re|Fwd):\s*/i, "")}`,
      inReplyTo: mode === "forward" ? undefined : activeMessage.messageId,
      body:
        mode === "forward"
          ? `\n\n---------- Forwarded message ----------\nFrom: ${activeMessage.from.address}\nDate: ${activeMessage.date}\nSubject: ${activeMessage.subject}\n\n${activeMessage.textBody}`
          : "",
    });
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable ||
        target.closest('[role="dialog"], [role="menu"]') ||
        composeOpen ||
        settingsOpen ||
        shortcutsOpen ||
        rawModalContent !== null
      )
        return;
      const key = event.key.toLowerCase();
      const uids = activeMessage ? [activeMessage.uid] : selectedUids;
      if (key === "g") {
        goKey.current = Date.now();
        return;
      }
      if (key === "i" && Date.now() - goKey.current < 1200) {
        event.preventDefault();
        selectFolder("INBOX");
        return;
      }
      if (key === "c") {
        event.preventDefault();
        openCompose();
      } else if (key === "/") {
        event.preventDefault();
        document.getElementById("global-search-input")?.focus();
      } else if (key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (key === "escape") backToList();
      else if (key === "e" && uids.length) {
        event.preventDefault();
        void handleArchive(uids);
      } else if (key === "#" && uids.length) {
        event.preventDefault();
        void handleDelete(uids);
      } else if (key === "s" && uids.length) {
        event.preventDefault();
        void handleToggleStar(uids[0]);
      } else if (["r", "a", "f"].includes(key) && activeMessage) {
        event.preventDefault();
        reply(key === "r" ? "reply" : key === "a" ? "all" : "forward");
      } else if (key === "j" || key === "k") {
        event.preventDefault();
        const focusedUid = Number(
          document.activeElement?.getAttribute("data-message-open"),
        );
        const index = messages.findIndex(
          (message) => message.uid === (activeMessage?.uid || focusedUid),
        );
        const next =
          messages[
            Math.max(
              0,
              Math.min(messages.length - 1, index + (key === "j" ? 1 : -1)),
            )
          ];
        if (next) {
          if (activeMessage) void handleSelectMessage(next.uid);
          else
            document
              .querySelector<HTMLButtonElement>(
                `[data-message-open="${next.uid}"]`,
              )
              ?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  if (authChecking || !user)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5">
        <Mail className="text-primary" size={36} />
        <p role="status" className="text-sm text-muted-foreground">
          Opening your mailbox…
        </p>
      </main>
    );
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-card focus:p-3"
      >
        Skip to mail
      </a>
      <Navbar
        user={user}
        query={query}
        sidebarExpanded={!collapsed || mobileOpen}
        onToggleSidebar={() => {
          if (matchMedia("(max-width: 767px)").matches) setMobileOpen(true);
          else {
            setCollapsed(!collapsed);
            localStorage.setItem(
              "mailhive-sidebar",
              collapsed ? "expanded" : "collapsed",
            );
          }
        }}
        onSearch={(value) => selectFolder(value ? `search:${value}` : "INBOX")}
        onOpenSettings={() => {
          setSettingsTab("profile");
          setSettingsOpen(true);
        }}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onLogout={async () => {
          await api.logout();
          router.push("/login");
        }}
      />
      {offline && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-xs text-amber-950"
        >
          <WifiOff size={15} />
          You’re offline. Reconnect to refresh your mail or send messages.
        </div>
      )}
      <div className="flex min-h-0 flex-1 sm:pb-4 sm:pr-4">
        <Sidebar
          currentFolder={currentFolder}
          onSelectFolder={selectFolder}
          folders={folders}
          labels={labels}
          onOpenCompose={() => openCompose()}
          onCreateLabel={() => {
            setSettingsTab("labels");
            setSettingsOpen(true);
            setMobileOpen(false);
          }}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 md:pl-0 sm:pl-4"
        >
          {activeMessage || loadingActiveMessage ? (
            <ReadingPane
              message={activeMessage}
              loading={loadingActiveMessage}
              folder={sourceFolder}
              onBack={backToList}
              onArchive={(uid) => void handleArchive([uid])}
              onDelete={(uid) => void handleDelete([uid])}
              onMarkUnread={(uid) => {
                void handleMarkRead([uid], false);
                backToList();
              }}
              onReply={() => reply("reply")}
              onReplyAll={() => reply("all")}
              onForward={() => reply("forward")}
              onToggleStar={handleToggleStar}
              onShowRaw={async (uid) => {
                try {
                  setRawModalContent(
                    await api.getRawMessage(uid, sourceFolder),
                  );
                } catch (error) {
                  notifyError(error);
                }
              }}
              onTrustSender={async (email) => {
                await api.addTrustedSender(email);
                setNotice({ text: `${email} added to trusted senders.` });
              }}
            />
          ) : (
            <MessageList
              messages={messages}
              loading={loadingMessages}
              error={loadError}
              title={title}
              isSearch={!!query}
              unreadOnly={unreadOnly}
              onUnreadChange={(value) => {
                setUnreadOnly(value);
                setPage(1);
              }}
              folders={folders}
              labels={labels}
              selectedUids={selectedUids}
              onToggleSelect={(uid) =>
                setSelectedUids((previous) =>
                  previous.includes(uid)
                    ? previous.filter((id) => id !== uid)
                    : [...previous, uid],
                )
              }
              onSelectAll={(all) =>
                setSelectedUids(
                  all ? messages.map((message) => message.uid) : [],
                )
              }
              onSelectMessage={handleSelectMessage}
              onToggleStar={handleToggleStar}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onMarkRead={handleMarkRead}
              onMove={handleMove}
              onLabel={handleLabel}
              onRefresh={() => refresh.current()}
              onCompose={() => openCompose()}
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          )}
        </main>
      </div>
      {composeOpen && (
        <ComposeModal
          isOpen
          onClose={() => {
            setComposeOpen(false);
            void loadFoldersAndLabels();
          }}
          initialTo={composeInitial.to}
          initialSubject={composeInitial.subject}
          initialInReplyTo={composeInitial.inReplyTo}
          initialBody={composeInitial.body}
          initialHtml={composeInitial.html}
          initialCc={composeInitial.cc}
          initialBcc={composeInitial.bcc}
          existingDraftUid={composeInitial.draftUid}
          onSent={(sentCopySaved) => {
            setNotice({ text: sentCopySaved ? "Your message has been sent." : "Message sent, but the copy could not be saved in Sent. Do not resend it." });
            refresh.current();
          }}
        />
      )}
      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <SettingsModal
        isOpen={settingsOpen}
        initialTab={settingsTab}
        onClose={() => {
          setSettingsOpen(false);
          void loadFoldersAndLabels();
        }}
        user={user}
        onProfileUpdated={() => {
          void api.getMe().then((result) => setUser(result.user));
          void loadFoldersAndLabels();
        }}
      />
      <Modal
        open={rawModalContent !== null}
        onClose={() => setRawModalContent(null)}
        title="Original message"
        className="max-w-3xl"
      >
        <pre className="overflow-auto whitespace-pre-wrap break-words p-6 font-mono text-xs leading-6">
          {rawModalContent}
        </pre>
      </Modal>
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className="fixed bottom-5 left-1/2 z-[70] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border bg-popover px-4 py-2 text-sm shadow-xl"
        >
          {notice.error ? (
            <AlertCircle size={18} className="shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 size={18} className="shrink-0 text-primary" />
          )}
          <span>{notice.text}</span>
          <IconButton
            label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
