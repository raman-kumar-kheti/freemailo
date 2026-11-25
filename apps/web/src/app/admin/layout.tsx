"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Globe,
  Mail,
  Forward,
  Cpu,
  History,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { IconButton } from "@/components/ui/mail-ui";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/domains", label: "Domains & DNS", icon: Globe },
  { href: "/admin/mailboxes", label: "Mailboxes & Quota", icon: Mail },
  { href: "/admin/aliases", label: "Aliases & Forwarding", icon: Forward },
  { href: "/admin/jobs", label: "Provisioning Queue", icon: Cpu },
  { href: "/admin/audit", label: "Audit Trail", icon: History },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    let active = true;
    api
      .getAdminMe()
      .then(({ user }) => {
        if (!active) return;
        if (!["ADMIN", "SUPER_ADMIN"].includes(user.role))
          router.replace("/admin/login");
        else setAdminUser(user);
      })
      .catch(() => {
        if (active) router.replace("/admin/login");
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    setNavigationOpen(false);
  }, [pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  const handleLogout = async () => {
    await api.adminLogout();
    router.push("/admin/login");
  };
  const currentPage =
    navItems.find((item) => item.href === pathname)?.label || "Overview";
  const navigation = (
    <>
      <div className="px-5 pb-4 pt-7 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Workspace
      </div>
      <nav aria-label="Administration" className="space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm transition-colors ${pathname === href ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mx-5 mt-8 rounded-2xl border bg-card/50 p-4">
        <ShieldCheck
          size={20}
          className="mb-2 text-primary"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">Your mail workspace</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Manage the domains, people and settings behind your inbox.
        </p>
      </div>
      <div className="mt-auto space-y-1 p-3 pt-8">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-3 rounded-full px-4 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Mail size={18} aria-hidden="true" />
          Open webmail
          <ArrowUpRight size={15} className="ml-auto" aria-hidden="true" />
        </Link>
        <button
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-full px-4 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut size={18} aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-card focus:p-3"
      >
        Skip to main content
      </a>
      <header className="flex h-[76px] items-center gap-3 px-4 sm:px-6">
        <Dialog.Root open={navigationOpen} onOpenChange={setNavigationOpen}>
          <Dialog.Trigger asChild>
            <IconButton label="Open admin navigation" className="lg:hidden">
              <Menu size={21} />
            </IconButton>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 left-0 z-50 flex w-[min(288px,85vw)] flex-col overflow-y-auto bg-background pb-4 shadow-xl"
            >
              <div className="flex items-center justify-between px-5 pt-5">
                <Dialog.Title className="text-lg font-semibold">
                  Administration
                </Dialog.Title>
                <Dialog.Close asChild>
                  <IconButton label="Close admin navigation">
                    <X size={20} />
                  </IconButton>
                </Dialog.Close>
              </div>
              {navigation}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <Link
          href="/admin"
          aria-label="FreeMailo administration home"
          className="flex shrink-0 items-center gap-2.5 rounded-lg lg:w-[216px]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail size={21} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            FreeMailo
          </span>
        </Link>
        <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          <span>Administration</span>
          <span aria-hidden="true">/</span>
          <span className="text-foreground">{currentPage}</span>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <div className="hidden min-w-0 text-right sm:block">
            <p className="max-w-56 truncate text-sm font-medium">
              {adminUser?.email || "Loading account…"}
            </p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <span
            aria-hidden="true"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground sm:flex"
          >
            AD
          </span>
        </div>
      </header>
      <div className="flex items-start">
        <aside className="sticky top-0 hidden min-h-[calc(100dvh-76px)] w-60 shrink-0 flex-col lg:flex">
          {navigation}
        </aside>
        <main
          id="admin-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-3 pb-4 outline-none sm:px-5 lg:pl-2 lg:pr-6"
        >
          <div className="min-h-[calc(100dvh-92px)] rounded-2xl bg-card px-4 py-6 sm:p-7 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
