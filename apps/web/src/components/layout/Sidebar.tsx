'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Inbox, Star, Send, FileText, Archive, AlertOctagon, Trash2, Tag, Plus, PenLine, X, Keyboard } from 'lucide-react';
import { Folder, Label } from '@/lib/api';
import { IconButton } from '@/components/ui/mail-ui';

interface SidebarProps {
  currentFolder: string;
  onSelectFolder: (folder: string) => void;
  folders: Folder[];
  labels: Label[];
  onOpenCompose: () => void;
  onCreateLabel: () => void;
  onOpenShortcuts: () => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ currentFolder, onSelectFolder, folders, labels, onOpenCompose, onCreateLabel, onOpenShortcuts, collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const folderPath = (name: string, specialUse: string) => folders.find((folder) => folder.specialUse === specialUse)?.path || folders.find((folder) => folder.path.toLowerCase() === name.toLowerCase())?.path || name;
  const inboxCount = folders.find((folder) => folder.path.toUpperCase() === 'INBOX')?.unread || 0;
  const navItems = [
    { id: 'INBOX', name: 'Inbox', icon: Inbox, count: inboxCount },
    { id: 'STARRED', name: 'Starred', icon: Star },
    { id: folderPath('Sent', '\\Sent'), name: 'Sent', icon: Send },
    { id: folderPath('Drafts', '\\Drafts'), name: 'Drafts', icon: FileText, count: folders.find((folder) => folder.specialUse === '\\Drafts' || folder.path === 'Drafts')?.total },
    { id: folderPath('Archive', '\\Archive'), name: 'Archive', icon: Archive },
    { id: folderPath('Junk', '\\Junk'), name: 'Spam', icon: AlertOctagon },
    { id: folderPath('Trash', '\\Trash'), name: 'Trash', icon: Trash2 },
  ];
  const contents = (compact: boolean) => <>
    <div className={compact ? 'px-3 pb-6 pt-2' : 'px-5 pb-7 pt-2'}>
      <button onClick={() => { onOpenCompose(); onCloseMobile(); }} aria-label="Compose" title="Compose (c)" className={`flex h-14 items-center justify-center gap-3 rounded-2xl bg-accent font-medium text-accent-foreground transition-shadow hover:shadow-md ${compact ? 'w-14' : 'px-6'}`}><PenLine size={22} />{!compact && <span className="text-sm">Compose</span>}</button>
    </div>
    <nav aria-label="Mail folders" className={compact ? 'space-y-1 px-3' : 'space-y-0.5 pl-3 pr-4'}>
      {navItems.map(({ id, name, icon: Icon, count }) => <button key={id} aria-label={name} aria-current={currentFolder === id ? 'page' : undefined} title={compact ? `${name}${count ? ` (${count})` : ''}` : undefined} onClick={() => { onSelectFolder(id); onCloseMobile(); }} className={`relative flex h-10 w-full items-center gap-4 rounded-full text-sm ${compact ? 'justify-center' : 'px-4'} ${currentFolder === id ? 'bg-accent font-semibold text-accent-foreground' : 'text-foreground hover:bg-secondary'}`}>
        <Icon size={18} strokeWidth={currentFolder === id ? 2.2 : 1.7} />
        {!compact && <><span>{name}</span>{!!count && <span className="ml-auto text-xs tabular-nums">{count.toLocaleString()}</span>}</>}
        {compact && !!count && <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
      </button>)}
    </nav>
    {!compact && <div className="mt-7 min-h-0 flex-1 overflow-y-auto pl-7 pr-5">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">Labels</h2><IconButton label="Create new label" onClick={onCreateLabel}><Plus size={18} /></IconButton></div>
      <div className="space-y-1">{labels.map((label) => <button key={label.id} onClick={() => { onSelectFolder(`label:${label.name}`); onCloseMobile(); }} aria-current={currentFolder === `label:${label.name}` ? 'page' : undefined} className={`-ml-3 flex h-9 w-[calc(100%+0.75rem)] items-center gap-4 rounded-full px-3 text-sm hover:bg-secondary ${currentFolder === `label:${label.name}` ? 'bg-accent font-medium' : ''}`}><Tag size={17} style={{ color: label.color || 'hsl(var(--primary))' }} /><span className="truncate">{label.name}</span></button>)}</div>
      {!labels.length && <p className="py-2 text-xs leading-5 text-muted-foreground">A little order for your inbox.<br /><button onClick={onCreateLabel} className="mt-1 font-medium text-primary hover:underline">Create your first label</button></p>}
    </div>}
    <div className={`mt-auto pb-5 pt-5 ${compact ? 'px-5' : 'px-7'}`}>
      <button onClick={onOpenShortcuts} title="Keyboard shortcuts" className="flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground"><Keyboard size={16} />{!compact && <>Keyboard shortcuts <kbd className="ml-1 rounded border px-1.5">?</kbd></>}</button>
      {!compact && <p className="mt-4 text-[11px] text-muted-foreground">MailHive · Your mail, your space.</p>}
    </div>
  </>;
  return <>
    <aside id="mail-navigation" aria-label="Mailbox navigation" className={`hidden shrink-0 flex-col md:flex ${collapsed ? 'w-20' : 'w-[256px]'}`}>{contents(collapsed)}</aside>
    <Dialog.Root open={mobileOpen} onOpenChange={(value) => !value && onCloseMobile()}><Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/40" />
      <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background shadow-xl">
        <div className="flex items-center justify-between px-6 py-4"><Dialog.Title className="text-lg font-semibold">MailHive</Dialog.Title><Dialog.Close asChild><IconButton label="Close navigation"><X size={20} /></IconButton></Dialog.Close></div>
        {contents(false)}
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root>
  </>;
}
