'use client';

import React, { useState } from 'react';
import {
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  AlertOctagon,
  Trash2,
  Tag,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  PenSquare,
} from 'lucide-react';
import { Folder } from '@/lib/api';

interface SidebarProps {
  currentFolder: string;
  onSelectFolder: (folder: string) => void;
  folders: Folder[];
  labels: Array<{ id: string; name: string; color?: string }>;
  onOpenCompose: () => void;
  onOpenSettings: () => void;
  onCreateLabel: () => void;
}

export function Sidebar({
  currentFolder,
  onSelectFolder,
  folders,
  labels,
  onOpenCompose,
  onOpenSettings,
  onCreateLabel,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Helper to find unread / total count for system folders
  const getCount = (name: string): number => {
    const f = folders.find(
      (item) => item.name.toLowerCase() === name.toLowerCase() || item.path.toLowerCase() === name.toLowerCase(),
    );
    if (!f) return 0;
    if (name.toLowerCase() === 'inbox') return f.unread;
    if (name.toLowerCase() === 'drafts') return f.total;
    return f.unread || 0;
  };

  const navItems = [
    { id: 'INBOX', name: 'Inbox', icon: Inbox, count: getCount('INBOX') },
    { id: 'STARRED', name: 'Starred', icon: Star, count: 0 },
    { id: 'Sent', name: 'Sent', icon: Send, count: 0 },
    { id: 'Drafts', name: 'Drafts', icon: FileText, count: getCount('Drafts') },
    { id: 'Archive', name: 'Archive', icon: Archive, count: 0 },
    { id: 'Junk', name: 'Spam', icon: AlertOctagon, count: getCount('Junk') },
    { id: 'Trash', name: 'Trash', icon: Trash2, count: 0 },
  ];

  return (
    <aside
      className={`h-[calc(100vh-4rem)] border-r border-border bg-background transition-all duration-200 flex flex-col justify-between select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="p-3 space-y-4 overflow-y-auto">
        {/* Gmail-style Compose Button */}
        <div className="pt-2">
          <button
            onClick={onOpenCompose}
            className={`flex items-center justify-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-md transition-all rounded-2xl ${
              collapsed ? 'w-12 h-12 p-0 mx-auto' : 'w-full py-3.5 px-5'
            }`}
            title="Compose New Email (c)"
          >
            <PenSquare className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-semibold text-sm tracking-wide">Compose</span>}
          </button>
        </div>

        {/* Navigation Folders */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = currentFolder === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectFolder(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                }`}
                title={item.name}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </div>
                {!collapsed && item.count > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Labels Section */}
        {!collapsed && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Labels
              </span>
              <button
                onClick={onCreateLabel}
                className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
                title="Create New Label"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {labels.map((lbl) => (
                <button
                  key={lbl.id}
                  onClick={() => onSelectFolder(`label:${lbl.name}`)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: lbl.color || '#3b82f6' }}
                  />
                  <span className="truncate text-xs">{lbl.name}</span>
                </button>
              ))}
              {labels.length === 0 && (
                <p className="px-3 text-xs text-muted-foreground italic">No custom labels</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls: Settings & Collapse Toggle */}
      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
