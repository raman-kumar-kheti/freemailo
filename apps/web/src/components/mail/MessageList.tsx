'use client';

import React, { useState } from 'react';
import { Star, Paperclip, RotateCw, Archive, Trash2, Mail, MailOpen, ChevronLeft, ChevronRight, FolderInput, Tag, Inbox, SlidersHorizontal, Check, AlertCircle, Search } from 'lucide-react';
import { Folder, Label, MessageListItem } from '@/lib/api';
import { IconButton, Menu, MenuItem } from '@/components/ui/mail-ui';

interface MessageListProps {
  messages: MessageListItem[]; loading: boolean; error: string; title: string; isSearch: boolean;
  unreadOnly: boolean; onUnreadChange: (unread: boolean) => void;
  folders: Folder[]; labels: Label[];
  selectedUids: number[];
  onToggleSelect: (uid: number) => void; onSelectAll: (all: boolean) => void;
  onSelectMessage: (uid: number) => void; onToggleStar: (uid: number) => void;
  onArchive: (uids: number[]) => void; onDelete: (uids: number[]) => void;
  onMarkRead: (uids: number[], isRead: boolean) => void;
  onMove: (uids: number[], folder: string) => void; onLabel: (uids: number[], label: string) => void;
  onRefresh: () => void; onCompose: () => void;
  page: number; pageSize: number; total: number; onPageChange: (newPage: number) => void;
}
export function MessageList({ messages, loading, error, title, isSearch, unreadOnly, onUnreadChange, folders, labels, selectedUids, onToggleSelect, onSelectAll, onSelectMessage, onToggleStar, onArchive, onDelete, onMarkRead, onMove, onLabel, onRefresh, onCompose, page, pageSize, total, onPageChange }: MessageListProps) {
  const [compact, setCompact] = useState(false);
  const allSelected = messages.length > 0 && selectedUids.length === messages.length;
  const someSelected = selectedUids.length > 0;
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  return <section className="mail-surface" aria-label={title} aria-busy={loading}>
    <div className="flex min-h-[76px] shrink-0 items-center justify-between gap-3 px-5 sm:px-7">
      <div className="min-w-0"><h1 className="truncate text-[22px] font-normal tracking-tight">{title}</h1><p className="mt-1 text-xs text-muted-foreground">{isSearch ? 'Find just what you’re looking for.' : unreadOnly ? 'A little focus for what’s new.' : 'A little space for everything that matters.'}</p></div>
      <div className="flex shrink-0 gap-1 rounded-full bg-secondary/80 p-1" aria-label="Message filter">
        <button onClick={() => onUnreadChange(false)} aria-pressed={!unreadOnly} className={`rounded-full px-3 py-1.5 text-xs ${!unreadOnly ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`}>All</button>
        <button onClick={() => onUnreadChange(true)} aria-pressed={unreadOnly} className={`rounded-full px-3 py-1.5 text-xs ${unreadOnly ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`}>Unread</button>
      </div>
    </div>
    <div className={`flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-1 border-y px-3 sm:px-4 ${someSelected ? 'bg-accent/50' : ''}`}>
      <div className="flex items-center gap-0.5">
        <label title="Select all" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-secondary"><input type="checkbox" aria-label="Select all messages" checked={allSelected} disabled={loading || !messages.length} ref={(input) => { if (input) input.indeterminate = someSelected && !allSelected; }} onChange={(e) => onSelectAll(e.target.checked)} className="h-4 w-4" /></label>
        {someSelected ? <>
          <span className="mr-2 hidden text-xs text-accent-foreground lg:inline">{selectedUids.length} selected</span>
          <IconButton label="Archive selected" onClick={() => onArchive(selectedUids)}><Archive size={18} /></IconButton>
          <IconButton label="Delete selected" onClick={() => onDelete(selectedUids)}><Trash2 size={18} /></IconButton>
          <IconButton label="Mark as read" onClick={() => onMarkRead(selectedUids, true)}><MailOpen size={18} /></IconButton>
          <IconButton label="Mark as unread" onClick={() => onMarkRead(selectedUids, false)}><Mail size={18} /></IconButton>
          <Menu trigger={<IconButton label="Move to folder"><FolderInput size={18} /></IconButton>}>{folders.map((folder) => <MenuItem key={folder.path} onSelect={() => onMove(selectedUids, folder.path)}><FolderInput size={15} />{folder.name}</MenuItem>)}</Menu>
          <Menu trigger={<IconButton label="Apply label"><Tag size={18} /></IconButton>}>{labels.length ? labels.map((label) => <MenuItem key={label.id} onSelect={() => onLabel(selectedUids, label.name)}><Tag size={15} style={{ color: label.color }} />{label.name}</MenuItem>) : <p className="px-3 py-2 text-xs text-muted-foreground">Create a label in Settings first.</p>}</Menu>
        </> : <>
          <IconButton label="Refresh" disabled={loading} onClick={onRefresh}><RotateCw size={17} className={loading ? 'animate-spin' : ''} /></IconButton>
          <Menu trigger={<IconButton label="Display density"><SlidersHorizontal size={17} /></IconButton>}><MenuItem onSelect={() => setCompact(false)}><span className="w-4">{!compact && <Check size={15} />}</span>Comfortable</MenuItem><MenuItem onSelect={() => setCompact(true)}><span className="w-4">{compact && <Check size={15} />}</span>Compact</MenuItem></Menu>
        </>}
      </div>
      <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><span className="mr-2 tabular-nums" aria-live="polite">{start}–{end} of {total.toLocaleString()}</span><IconButton label="Previous page" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}><ChevronLeft size={18} /></IconButton><IconButton label="Next page" disabled={end >= total || loading} onClick={() => onPageChange(page + 1)}><ChevronRight size={18} /></IconButton></div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? <div role="status" className="divide-y"><span className="sr-only">Loading messages</span>{Array.from({ length: 10 }, (_, i) => <div key={i} className="flex h-14 animate-pulse items-center gap-6 px-6"><div className="h-4 w-4 rounded bg-muted" /><div className="h-3 w-28 rounded bg-muted" /><div className="h-3 flex-1 rounded bg-muted" /><div className="h-3 w-12 rounded bg-muted" /></div>)}</div> : error ? <div role="alert" className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center"><AlertCircle size={32} className="text-destructive" /><h2 className="font-medium">Couldn’t load your mail</h2><p className="max-w-sm text-sm text-muted-foreground">{error}</p><button onClick={onRefresh} className="primary-button mt-2">Try again</button></div> : !messages.length ? <div className="flex min-h-[380px] flex-col items-center justify-center px-6 text-center"><div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/60 text-primary">{isSearch ? <Search size={34} strokeWidth={1.4} /> : <Inbox size={36} strokeWidth={1.4} />}</div><h2 className="text-xl tracking-tight">{isSearch ? 'No matching messages' : unreadOnly ? 'You’re all caught up' : 'A little breathing room'}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{isSearch ? 'Try a different keyword or adjust your search filters.' : unreadOnly ? 'There are no unread messages in this folder.' : 'No messages here. When mail arrives, you’ll find it right here.'}</p>{!isSearch && <button onClick={onCompose} className="mt-6 text-sm font-medium text-primary hover:underline">Write a new message</button>}</div> : <ul aria-label="Messages">
        {messages.map((msg) => {
          const selected = selectedUids.includes(msg.uid);
          return <li key={msg.uid} className={`mail-row group ${compact ? 'min-h-11' : 'min-h-[54px]'}`} data-read={msg.isRead} data-selected={selected}>
            <label className="hidden h-9 w-9 shrink-0 cursor-pointer items-center justify-center sm:flex"><input type="checkbox" aria-label={`Select ${msg.subject || '(no subject)'}`} checked={selected} onChange={() => onToggleSelect(msg.uid)} className="h-4 w-4" /></label>
            <IconButton label={`${msg.isStarred ? 'Unstar' : 'Star'} ${msg.subject}`} aria-pressed={msg.isStarred} onClick={() => onToggleStar(msg.uid)} className="order-2 ml-1 h-10 w-8 sm:order-none sm:ml-0 sm:mr-3"> <Star size={17} className={msg.isStarred ? 'fill-amber-400 text-amber-600 dark:text-amber-400' : ''} /></IconButton>
            <button data-message-open={msg.uid} onClick={() => onSelectMessage(msg.uid)} className="flex min-w-0 flex-1 flex-col gap-1 py-3 text-left outline-offset-[-3px] sm:flex-row sm:items-center sm:gap-5 sm:py-2.5">
              <span className={`w-full truncate pr-20 sm:w-40 sm:shrink-0 sm:pr-0 lg:w-44 ${!msg.isRead ? 'font-semibold' : ''}`}>{msg.from.name || msg.from.address}</span>
              <span className="flex w-full min-w-0 flex-1 items-center gap-2">
                {msg.labels.filter((label) => !label.startsWith('\\')).slice(0, 2).map((label) => <span key={label} className="hidden max-w-24 truncate rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground xl:inline">{label}</span>)}
                <span className="truncate"><span className={!msg.isRead ? 'font-semibold' : ''}>{msg.subject || '(no subject)'}</span>{msg.snippet && <span className="hidden font-normal text-muted-foreground sm:inline"> <span className="mx-1">–</span> {msg.snippet}</span>}</span>
              </span>
              <span className="w-full truncate text-xs text-muted-foreground sm:hidden">{msg.snippet}</span>
              <span className="absolute right-12 top-3 flex items-center gap-2 sm:static sm:ml-auto sm:w-24 sm:shrink-0 sm:justify-end">
                {msg.hasAttachments && <Paperclip size={14} aria-label="Has attachments" />}
                <time dateTime={msg.date} className={`whitespace-nowrap text-[11px] ${!msg.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>{formatDate(msg.date)}</time>
              </span>
            </button>
            <div className="absolute right-3 hidden items-center rounded-full bg-card px-1 shadow-sm sm:group-hover:flex sm:group-focus-within:flex">
              <IconButton label={`Archive ${msg.subject}`} onClick={() => onArchive([msg.uid])}><Archive size={17} /></IconButton><IconButton label={`Delete ${msg.subject}`} onClick={() => onDelete([msg.uid])}><Trash2 size={17} /></IconButton><IconButton label={`Mark ${msg.subject} as ${msg.isRead ? 'unread' : 'read'}`} onClick={() => onMarkRead([msg.uid], !msg.isRead)}>{msg.isRead ? <Mail size={17} /> : <MailOpen size={17} />}</IconButton>
            </div>
          </li>;
        })}
      </ul>}
    </div>
    <div className="hidden shrink-0 items-center justify-between border-t px-6 py-3 text-[11px] text-muted-foreground sm:flex"><span>{someSelected ? `${selectedUids.length} messages selected on this page` : 'Your inbox. A little more organized.'}</span><span>MailHive</span></div>
  </section>;
}
