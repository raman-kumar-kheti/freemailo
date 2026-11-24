"use client";

import React, { useState } from "react";
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@freemailo.local");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.adminLogin(email.trim(), password);
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-4 sm:p-8">
      <div className="auth-card relative max-w-md w-full bg-card border border-border shadow-sm rounded-3xl p-6 sm:p-8 space-y-6 text-foreground">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary mx-auto flex items-center justify-center text-primary-foreground">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            FreeMailo Admin Console
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in with administrative privileges to manage domains and
            mailboxes
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-center"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="admin-email"
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@freemailo.local"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              Admin Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="admin-password"
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                Enter Admin Console
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-border text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to webmail sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
