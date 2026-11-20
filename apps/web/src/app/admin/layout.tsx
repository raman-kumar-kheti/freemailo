'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/navigation';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Globe,
  Mail,
  Forward,
  Cpu,
  History,
  LogOut,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);

  useEffect(() => {
    if (pathname === '/admin/login') return;

    let active = true;
    api.getMe().then(({ user }) => {
      if (!active) return;
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) router.replace('/admin/login');
      else setAdminUser(user);
    }).catch(() => { if (active) router.replace('/admin/login'); });
    return () => { active = false; };
  }, [pathname, router]);

  // If on login page, render full screen without dashboard shell
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await api.logout();
    router.push('/admin/login');
  };

  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/domains', label: 'Domains & DNS', icon: Globe },
    { href: '/admin/mailboxes', label: 'Mailboxes & Quota', icon: Mail },
    { href: '/admin/aliases', label: 'Aliases & Forwarding', icon: Forward },
    { href: '/admin/jobs', label: 'Provisioning Queue', icon: Cpu },
    { href: '/admin/audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/60 backdrop-blur-xl flex flex-col justify-between p-4 select-none">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">MailHive</span>
              <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">
                Admin Console
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="space-y-2 pt-4 border-t border-zinc-800/80">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:bg-zinc-800/60 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Switch to Webmail
            </span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-zinc-800 bg-zinc-900/40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">MailHive Cluster:</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
              HEALTHY • 100% POSTFIX/DOVECOT
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-semibold text-zinc-200 block">
                {adminUser?.email || 'admin@mailhive.local'}
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                Super Admin
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
