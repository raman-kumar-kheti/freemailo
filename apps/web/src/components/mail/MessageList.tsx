'use client';

import React from 'react';
import {
  Star,
  Paperclip,
  RotateCw,
  Archive,
  Trash2,
  Mail,
  MailOpen,
  ChevronLeft,
  ChevronRight,
  FolderInput,
} from 'lucide-react';
import { MessageListItem } from '@/lib/api';

interface MessageListProps {
  messages: MessageListItem[];
  loading: boolean;
  selectedUids: number[];
  onToggleSelect: (uid: number) => void;
  onSelectAll: (all: boolean) => void;
  onSelectMessage: (uid: number) => void;
  onToggleStar: (uid: number, e: React.MouseEvent) => void;
  onArchive: (uids: number[]) => void;
  onDelete: (uids: number[]) => void;
  onMarkRead: (uids: number[], isRead: boolean) => void;
  onRefresh: () => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
}

export function MessageList({
  messages,
  loading,
  selectedUids,
  onToggleSelect,
  onSelectAll,
  onSelectMessage,
  onToggleStar,
  onArchive,
  onDelete,
  onMarkRead,
  onRefresh,
  page,
  pageSize,
  total,
  onPageChange,
}: MessageListProps) {
  const allSelected = messages.length > 0 && selectedUids.length === messages.length;
  const someSelected = selectedUids.length > 0;

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Bulk Action Toolbar */}
      <div className="h-12 border-b border-border px-4 flex items-center justify-between text-muted-foreground bg-secondary/30 select-none">
        <div className="flex items-center gap-2">
          {/* Select all checkbox */}
          <div className="p-1 rounded hover:bg-secondary">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected && !allSelected;
              }}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              title="Select all"
            />
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Action buttons appear when messages are selected */}
          {someSelected && (
            <div className="flex items-center gap-1 pl-2 border-l border-border animate-in fade-in">
              <button
                onClick={() => onArchive(selectedUids)}
                className="p-1.5 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
                title="Archive (e)"
              >
                <Archive className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(selectedUids)}
                className="p-1.5 rounded-lg hover:bg-secondary hover:text-destructive transition-colors"
                title="Delete (#)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMarkRead(selectedUids, true)}
                className="p-1.5 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
                title="Mark as read"
              >
                <MailOpen className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMarkRead(selectedUids, false)}
                className="p-1.5 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
                title="Mark as unread"
              >
                <Mail className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-3 text-xs">
          <span>
            {startItem}-{endItem} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-1 rounded hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={endItem >= total}
              onClick={() => onPageChange(page + 1)}
              className="p-1 rounded hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Message Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-muted/40 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <Mail className="w-10 h-10 mb-2 stroke-[1.5] text-muted-foreground" />
            <p className="text-sm font-medium">No messages found</p>
            <p className="text-xs text-muted-foreground">Your folder is clean</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = selectedUids.includes(msg.uid);
            return (
              <div
                key={msg.uid}
                onClick={() => onSelectMessage(msg.uid)}
                className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors relative hover:shadow-sm ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/40'
                    : msg.isRead
                      ? 'bg-background hover:bg-secondary/40 text-muted-foreground'
                      : 'bg-background hover:bg-secondary/40 text-foreground font-semibold'
                }`}
              >
                {/* Checkbox */}
                <div
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(msg.uid);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                </div>

                {/* Star Icon */}
                <button
                  type="button"
                  onClick={(e) => onToggleStar(msg.uid, e)}
                  className="p-1 flex-shrink-0 hover:text-amber-500 transition-colors"
                  title="Star (s)"
                >
                  <Star
                    className={`w-4 h-4 ${
                      msg.isStarred
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/40 group-hover:text-muted-foreground'
                    }`}
                  />
                </button>

                {/* Sender Name */}
                <div className="w-48 flex-shrink-0 truncate text-sm">
                  {msg.from.name || msg.from.address}
                </div>

                {/* Subject & Snippet */}
                <div className="flex-1 flex items-center gap-2 truncate">
                  <span className={`truncate ${!msg.isRead ? 'font-semibold text-foreground' : ''}`}>
                    {msg.subject || '(no subject)'}
                  </span>
                  {msg.snippet && (
                    <span className="text-xs text-muted-foreground truncate font-normal">
                      - {msg.snippet}
                    </span>
                  )}
                </div>

                {/* Attachment Icon */}
                {msg.hasAttachments && (
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}

                {/* Date / Quick Actions */}
                <div className="w-24 flex-shrink-0 text-right text-xs text-muted-foreground relative">
                  <span className="group-hover:hidden">{formatDate(msg.date)}</span>

                  {/* Hover Quick Action Buttons */}
                  <div className="hidden group-hover:flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-background/95 pl-2 py-0.5 shadow-sm rounded">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive([msg.uid]);
                      }}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title="Archive (e)"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete([msg.uid]);
                      }}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                      title="Delete (#)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkRead([msg.uid], !msg.isRead);
                      }}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title={msg.isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      {msg.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
