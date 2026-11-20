'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MessageList } from '@/components/mail/MessageList';
import { ReadingPane } from '@/components/mail/ReadingPane';
import { ComposeModal } from '@/components/mail/ComposeModal';
import { ShortcutsModal } from '@/components/mail/ShortcutsModal';
import { SettingsModal } from '@/components/mail/SettingsModal';
import { api, User, Folder, MessageListItem, MessageDetail } from '@/lib/api';
import { X } from 'lucide-react';

export default function MailboxApp() {
  const router = useRouter();

  // User auth state
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Folder & message state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('INBOX');
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedUids, setSelectedUids] = useState<number[]>([]);
  const [activeMessage, setActiveMessage] = useState<MessageDetail | null>(null);
  const [loadingActiveMessage, setLoadingActiveMessage] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);

  // Modals & UI controls
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<{ to?: string; subject?: string; inReplyTo?: string }>({});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rawModalContent, setRawModalContent] = useState<string | null>(null);

  // 1. Initial Auth Check
  useEffect(() => {
    async function checkAuth() {
      try {
        const { user } = await api.getMe();
        setUser(user);
      } catch (_) {
        router.push('/login');
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, [router]);

  // 2. Load Folders & Labels
  const loadFoldersAndLabels = useCallback(async () => {
    try {
      const [foldersRes, labelsRes] = await Promise.all([
        api.getFolders(),
        api.getLabels(),
      ]);
      setFolders(foldersRes.folders || []);
      setLabels(labelsRes.labels || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (user) {
      loadFoldersAndLabels();
    }
  }, [user, loadFoldersAndLabels]);

  // 3. Load Messages
  const loadMessages = useCallback(async (folder = currentFolder, p = page) => {
    setLoadingMessages(true);
    try {
      if (folder.startsWith('search:')) {
        const query = folder.replace('search:', '');
        const res = await api.searchMessages(query, 'INBOX', p, pageSize);
        setMessages(res.data || []);
        setTotal(res.total || 0);
      } else if (folder === 'STARRED') {
        const res = await api.searchMessages('is:starred', 'INBOX', p, pageSize);
        setMessages(res.data || []);
        setTotal(res.total || 0);
      } else {
        const res = await api.getMessages(folder, p, pageSize);
        setMessages(res.data || []);
        setTotal(res.total || 0);
      }
      setSelectedUids([]);
    } catch (_) {
      setMessages([]);
      setTotal(0);
    } finally {
      setLoadingMessages(false);
    }
  }, [currentFolder, page, pageSize]);

  useEffect(() => {
    if (user) {
      loadMessages(currentFolder, page);
    }
  }, [user, currentFolder, page, loadMessages]);

  // 4. Realtime SSE Connection for IMAP IDLE updates
  useEffect(() => {
    if (!user) return;

    let eventSource: EventSource | null = null;
    try {
      const token = api.getToken();
      eventSource = new EventSource(`/api/mail/events${token ? `?token=${encodeURIComponent(token)}` : ''}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'new_mail' || payload.type === 'flags_updated' || payload.type === 'expunge') {
            loadFoldersAndLabels();
            loadMessages();
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [user, loadFoldersAndLabels, loadMessages]);

  // 5. Global Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is inside input/textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setComposeInitial({});
        setComposeOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) searchInput.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (rawModalContent) setRawModalContent(null);
        else if (activeMessage) setActiveMessage(null);
      } else if (e.key === 'e') {
        // Archive
        e.preventDefault();
        if (activeMessage) {
          handleArchive([activeMessage.uid]);
        } else if (selectedUids.length > 0) {
          handleArchive(selectedUids);
        }
      } else if (e.key === '#') {
        // Delete
        e.preventDefault();
        if (activeMessage) {
          handleDelete([activeMessage.uid]);
        } else if (selectedUids.length > 0) {
          handleDelete(selectedUids);
        }
      } else if (e.key === 's') {
        // Star
        e.preventDefault();
        if (activeMessage) {
          handleToggleStar(activeMessage.uid);
        } else if (selectedUids.length > 0) {
          handleToggleStar(selectedUids[0]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMessage, selectedUids, shortcutsOpen, settingsOpen, rawModalContent]);

  // Actions
  const handleSelectMessage = async (uid: number) => {
    setLoadingActiveMessage(true);
    try {
      const msg = await api.getMessage(uid, currentFolder.startsWith('search:') ? 'INBOX' : currentFolder);
      setActiveMessage(msg);
      // Automatically mark as seen
      if (!msg.isRead) {
        api.updateFlags(currentFolder, [uid], ['\\Seen'], 'add').catch(() => {});
      }
    } catch (err: any) {
      alert(`Could not open message: ${err.message}`);
    } finally {
      setLoadingActiveMessage(false);
    }
  };

  const handleToggleStar = async (uid: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = messages.find((m) => m.uid === uid);
    const newStarred = target ? !target.isStarred : true;

    // Optimistic update
    setMessages(
      messages.map((m) => (m.uid === uid ? { ...m, isStarred: newStarred } : m)),
    );
    if (activeMessage && activeMessage.uid === uid) {
      setActiveMessage({ ...activeMessage, isStarred: newStarred });
    }

    try {
      await api.updateFlags(
        currentFolder.startsWith('search:') ? 'INBOX' : currentFolder,
        [uid],
        ['\\Flagged'],
        newStarred ? 'add' : 'remove',
      );
    } catch (_) {}
  };

  const handleArchive = async (uids: number[]) => {
    try {
      await api.moveMessages(
        currentFolder.startsWith('search:') ? 'INBOX' : currentFolder,
        'Archive',
        uids,
      );
      if (activeMessage && uids.includes(activeMessage.uid)) {
        setActiveMessage(null);
      }
      loadMessages();
      loadFoldersAndLabels();
    } catch (err: any) {
      alert(`Error archiving message: ${err.message}`);
    }
  };

  const handleDelete = async (uids: number[]) => {
    try {
      await api.deleteMessages(
        currentFolder.startsWith('search:') ? 'INBOX' : currentFolder,
        uids,
      );
      if (activeMessage && uids.includes(activeMessage.uid)) {
        setActiveMessage(null);
      }
      loadMessages();
      loadFoldersAndLabels();
    } catch (err: any) {
      alert(`Error deleting message: ${err.message}`);
    }
  };

  const handleMarkRead = async (uids: number[], isRead: boolean) => {
    try {
      await api.updateFlags(
        currentFolder.startsWith('search:') ? 'INBOX' : currentFolder,
        uids,
        ['\\Seen'],
        isRead ? 'add' : 'remove',
      );
      setMessages(
        messages.map((m) => (uids.includes(m.uid) ? { ...m, isRead } : m)),
      );
      loadFoldersAndLabels();
    } catch (_) {}
  };

  const handleSearch = (query: string) => {
    setActiveMessage(null);
    setCurrentFolder(`search:${query}`);
    setPage(1);
  };

  const handleShowRaw = async (uid: number) => {
    try {
      const raw = await api.getRawMessage(uid, currentFolder.startsWith('search:') ? 'INBOX' : currentFolder);
      setRawModalContent(raw);
    } catch (err: any) {
      alert(`Error loading raw message: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    router.push('/login');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onSearch={handleSearch}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentFolder={currentFolder}
          onSelectFolder={(f) => {
            setCurrentFolder(f);
            setActiveMessage(null);
            setPage(1);
          }}
          folders={folders}
          labels={labels}
          onOpenCompose={() => {
            setComposeInitial({});
            setComposeOpen(true);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onCreateLabel={() => setSettingsOpen(true)}
        />

        {/* Main Content: MessageList or ReadingPane */}
        {activeMessage ? (
          <ReadingPane
            message={activeMessage}
            loading={loadingActiveMessage}
            onBack={() => setActiveMessage(null)}
            onArchive={(uid) => handleArchive([uid])}
            onDelete={(uid) => handleDelete([uid])}
            onMarkUnread={(uid) => {
              handleMarkRead([uid], false);
              setActiveMessage(null);
            }}
            onReply={(to, subject, inReplyTo) => {
              setComposeInitial({ to, subject, inReplyTo });
              setComposeOpen(true);
            }}
            onShowRaw={handleShowRaw}
            onTrustSender={async (email) => {
              await api.addTrustedSender(email);
              alert(`Added ${email} to trusted senders list.`);
            }}
          />
        ) : (
          <MessageList
            messages={messages}
            loading={loadingMessages}
            selectedUids={selectedUids}
            onToggleSelect={(uid) => {
              setSelectedUids((prev) =>
                prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
              );
            }}
            onSelectAll={(all) => {
              setSelectedUids(all ? messages.map((m) => m.uid) : []);
            }}
            onSelectMessage={handleSelectMessage}
            onToggleStar={handleToggleStar}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onMarkRead={handleMarkRead}
            onRefresh={() => {
              loadFoldersAndLabels();
              loadMessages();
            }}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => setPage(p)}
          />
        )}
      </div>

      {/* Floating Compose Window */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        initialTo={composeInitial.to}
        initialSubject={composeInitial.subject}
        initialInReplyTo={composeInitial.inReplyTo}
        onSent={() => {
          loadFoldersAndLabels();
          loadMessages();
        }}
      />

      {/* Shortcuts Modal */}
      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onProfileUpdated={() => {
          api.getMe().then((res) => setUser(res.user));
          loadFoldersAndLabels();
        }}
      />

      {/* Show Original (Raw Message Source) Modal */}
      {rawModalContent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-popover border border-border rounded-2xl shadow-2xl max-w-3xl w-full h-[80vh] flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground">Raw RFC 5322 Message Source</h3>
              <button
                onClick={() => setRawModalContent(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 rounded-xl bg-secondary/50 font-mono text-xs text-foreground select-all leading-relaxed whitespace-pre-wrap">
              {rawModalContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
