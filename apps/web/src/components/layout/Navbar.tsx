'use client';

import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Moon,
  Sun,
  HelpCircle,
  LogOut,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { User } from '@/lib/api';

interface NavbarProps {
  user: User | null;
  onSearch: (query: string) => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

export function Navbar({ user, onSearch, onOpenShortcuts, onLogout }: NavbarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFrom, setAdvFrom] = useState('');
  const [advTo, setAdvTo] = useState('');
  const [advSubject, setAdvSubject] = useState('');
  const [advUnreadOnly, setAdvUnreadOnly] = useState(false);
  const [advStarredOnly, setAdvStarredOnly] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSimpleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };

  const handleAdvancedSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const parts: string[] = [];
    if (advFrom) parts.push(`from:${advFrom}`);
    if (advTo) parts.push(`to:${advTo}`);
    if (advSubject) parts.push(`subject:${advSubject}`);
    if (advUnreadOnly) parts.push('is:unread');
    if (advStarredOnly) parts.push('is:starred');
    const query = parts.join(' ');
    setSearchTerm(query);
    setShowAdvanced(false);
    onSearch(query);
  };

  const initials = user?.displayName
    ? user.displayName.substring(0, 2).toUpperCase()
    : user?.email
      ? user.email.substring(0, 2).toUpperCase()
      : 'MH';

  return (
    <header className="h-16 border-b border-border bg-background px-4 flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
          <Mail className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg leading-tight tracking-tight text-foreground flex items-center gap-1.5">
            MailHive
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              Webmail
            </span>
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[130px]">
            {user?.domain || 'mail.local'}
          </span>
        </div>
      </div>

      {/* Centered Search Bar */}
      <div className="flex-1 max-w-2xl relative">
        <form onSubmit={handleSimpleSearch} className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="global-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search mail (press / to focus, e.g. from:alice is:starred)"
            className="w-full h-11 pl-10 pr-12 rounded-full bg-secondary/80 border border-transparent focus:border-border focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all shadow-inner"
          />
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            title="Advanced Search Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </form>

        {/* Advanced Search Dropdown */}
        {showAdvanced && (
          <div className="absolute top-14 left-0 w-full bg-popover border border-border rounded-xl shadow-2xl p-5 z-50 text-sm animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-foreground mb-3 text-xs tracking-wider uppercase text-muted-foreground">
              Search Operators
            </h3>
            <form onSubmit={handleAdvancedSearch} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
                  <input
                    type="text"
                    value={advFrom}
                    onChange={(e) => setAdvFrom(e.target.value)}
                    placeholder="e.g. alice@example.test"
                    className="w-full px-3 py-1.5 rounded-lg border border-input bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
                  <input
                    type="text"
                    value={advTo}
                    onChange={(e) => setAdvTo(e.target.value)}
                    placeholder="e.g. bob@example.test"
                    className="w-full px-3 py-1.5 rounded-lg border border-input bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
                <input
                  type="text"
                  value={advSubject}
                  onChange={(e) => setAdvSubject(e.target.value)}
                  placeholder="Subject keywords"
                  className="w-full px-3 py-1.5 rounded-lg border border-input bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={advUnreadOnly}
                    onChange={(e) => setAdvUnreadOnly(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Unread only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={advStarredOnly}
                    onChange={(e) => setAdvStarredOnly(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Starred only</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label="Toggle Dark Mode"
          className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Toggle Dark Mode"
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        <button
          onClick={onOpenShortcuts}
          aria-label="Keyboard Shortcuts"
          className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* User Account Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-primary/20 transition-all focus:outline-none"
            title={user?.email || 'Account'}
          >
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-medium text-xs flex items-center justify-center shadow-sm">
              {initials}
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-xl p-3 z-50 text-sm animate-in fade-in">
              <div className="flex items-center gap-3 p-2 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
                  {initials}
                </div>
                <div className="overflow-hidden">
                  <p className="font-semibold text-foreground truncate">
                    {user?.displayName || 'Mailbox User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <div className="pt-2">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
