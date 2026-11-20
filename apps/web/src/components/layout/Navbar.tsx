"use client";

import React, { useEffect, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Moon,
  Sun,
  HelpCircle,
  LogOut,
  Mail,
  Menu as MenuIcon,
  Settings,
  X,
} from "lucide-react";
import { User } from "@/lib/api";
import { IconButton, Menu, MenuItem, Modal } from "@/components/ui/mail-ui";

interface NavbarProps {
  user: User | null;
  onSearch: (query: string) => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onToggleSidebar: () => void;
  sidebarExpanded: boolean;
  query: string;
}

export function Navbar({
  user,
  onSearch,
  onOpenShortcuts,
  onOpenSettings,
  onLogout,
  onToggleSidebar,
  sidebarExpanded,
  query,
}: NavbarProps) {
  const [searchTerm, setSearchTerm] = useState(query);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    subject: "",
    after: "",
    before: "",
    unread: false,
    starred: false,
  });
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setSearchTerm(query);
  }, [query]);
  useEffect(() => {
    const dark =
      localStorage.getItem("mailhive-theme") === "dark" ||
      (!localStorage.getItem("mailhive-theme") &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark", !isDark);
    localStorage.setItem("mailhive-theme", isDark ? "light" : "dark");
    setIsDark(!isDark);
  };
  const initials = (user?.displayName || user?.email || "MH")
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <>
      <header className="relative z-30 flex shrink-0 flex-wrap items-center gap-2 px-3 py-3 sm:h-[76px] sm:flex-nowrap sm:gap-4 sm:px-5">
        <div className="flex items-center gap-3 sm:w-[216px] sm:shrink-0">
          <IconButton
            label="Toggle navigation"
            onClick={onToggleSidebar}
            aria-expanded={sidebarExpanded}
            aria-controls="mail-navigation"
          >
            <MenuIcon size={21} />
          </IconButton>
          <a
            href="/"
            aria-label="MailHive home"
            className="flex items-center gap-2.5 rounded-lg"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Mail size={21} strokeWidth={1.8} />
            </span>
            <span className="text-[23px] font-semibold tracking-[-1px]">
              Mail
              <span className="font-normal text-muted-foreground">Hive</span>
            </span>
          </a>
        </div>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(searchTerm.trim());
          }}
          className="order-3 flex h-12 w-full items-center gap-1 rounded-2xl bg-secondary px-2 transition-colors focus-within:bg-card focus-within:shadow-sm focus-within:ring-1 focus-within:ring-border sm:order-none sm:max-w-[760px] sm:flex-1"
        >
          <IconButton label="Search mail" type="submit">
            <Search size={20} />
          </IconButton>
          <input
            id="global-search-input"
            aria-label="Search mail"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search mail"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {searchTerm ? (
            <IconButton
              label="Clear search"
              onClick={() => {
                setSearchTerm("");
                onSearch("");
              }}
            >
              <X size={18} />
            </IconButton>
          ) : (
            <kbd className="mr-2 hidden rounded border border-input px-1.5 text-xs text-muted-foreground lg:block">
              /
            </kbd>
          )}
          <IconButton
            label="Advanced search"
            onClick={() => setShowAdvanced(true)}
          >
            <SlidersHorizontal size={20} />
          </IconButton>
        </form>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <IconButton
            label="Keyboard Shortcuts"
            onClick={onOpenShortcuts}
            className="hidden lg:flex"
          >
            <HelpCircle size={20} />
          </IconButton>
          <IconButton label="Settings" onClick={onOpenSettings}>
            <Settings size={20} />
          </IconButton>
          <IconButton
            label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleTheme}
            className="hidden sm:flex"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </IconButton>
          <Menu
            align="end"
            trigger={
              <button
                aria-label={`Account menu ${initials}`}
                className="ml-2 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-card bg-accent text-sm font-semibold text-accent-foreground ring-1 ring-border"
              >
                {initials}
              </button>
            }
          >
            <div className="max-w-64 border-b px-3 py-3">
              <p className="truncate font-semibold">
                {user?.displayName || "Your mailbox"}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {user?.email}
              </p>
            </div>
            <MenuItem onSelect={toggleTheme}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}{" "}
              {isDark ? "Light theme" : "Dark theme"}
            </MenuItem>
            <MenuItem onSelect={onOpenShortcuts}>
              <HelpCircle size={16} />
              Keyboard shortcuts
            </MenuItem>
            <MenuItem onSelect={onLogout}>
              <LogOut size={16} />
              Sign out
            </MenuItem>
          </Menu>
        </div>
      </header>
      <Modal
        open={showAdvanced}
        onClose={() => setShowAdvanced(false)}
        title="Advanced search"
        className="max-w-xl"
      >
        <form
          className="space-y-4 overflow-y-auto p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const parts = (
              ["from", "to", "subject", "after", "before"] as const
            )
              .filter((key) => filters[key].trim())
              .map(
                (key) =>
                  `${key}:${filters[key].includes(" ") ? `"${filters[key].replace(/"/g, "")}"` : filters[key]}`,
              );
            if (filters.unread) parts.push("is:unread");
            if (filters.starred) parts.push("is:starred");
            onSearch(parts.join(" "));
            setShowAdvanced(false);
          }}
        >
          {(["from", "to", "subject", "after", "before"] as const).map(
            (key) => (
              <label
                key={key}
                className="grid grid-cols-[64px_1fr] items-center gap-4 text-sm"
              >
                <span className="capitalize text-muted-foreground">{key}</span>
                <input
                  className="field"
                  type={key === "after" || key === "before" ? "date" : "text"}
                  value={filters[key]}
                  onChange={(e) =>
                    setFilters({ ...filters, [key]: e.target.value })
                  }
                />
              </label>
            ),
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-3 border-t py-4">
            {(["unread", "starred"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters[key]}
                  onChange={(e) =>
                    setFilters({ ...filters, [key]: e.target.checked })
                  }
                />
                {`${key[0].toUpperCase()}${key.slice(1)} only`}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="submit" className="primary-button">
              <Search size={16} />
              Search
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
