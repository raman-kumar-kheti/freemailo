"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Lock,
  User,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  AtSign,
} from "lucide-react";
import { api, PublicDomain } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();

  // Form states
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [domainId, setDomainId] = useState("");
  const [domains, setDomains] = useState<PublicDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Availability check states
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availability, setAvailability] = useState<{
    checked: boolean;
    available: boolean;
    email?: string;
    message?: string;
  }>({ checked: false, available: false });

  // Submission states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load available domains on mount
  useEffect(() => {
    let mounted = true;
    async function loadDomains() {
      try {
        setDomainsLoading(true);
        const res = await api.getPublicDomains();
        if (mounted && res?.data?.length > 0) {
          setDomains(res.data);
          setDomainId(res.data[0].id);
        }
      } catch (err: any) {
        if (mounted) {
          setError("Failed to load email domains. Please try again later.");
        }
      } finally {
        if (mounted) setDomainsLoading(false);
      }
    }
    loadDomains();
    return () => {
      mounted = false;
    };
  }, []);

  // Debounced email availability check
  const checkUsername = useCallback(
    async (uname: string, dId: string) => {
      const cleanUname = uname.trim();
      if (!cleanUname || !dId) {
        setAvailability({ checked: false, available: false });
        return;
      }

      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(cleanUname)) {
        setAvailability({
          checked: true,
          available: false,
          message: "Can only contain letters, numbers, dots, hyphens, and underscores.",
        });
        return;
      }

      setCheckingAvailability(true);
      try {
        const res = await api.checkAvailability(cleanUname, dId);
        setAvailability({
          checked: true,
          available: res.available,
          email: res.email,
          message: res.message,
        });
      } catch (err: any) {
        setAvailability({
          checked: true,
          available: false,
          message: err.message || "Failed to verify availability",
        });
      } finally {
        setCheckingAvailability(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!username.trim() || !domainId) {
      setAvailability({ checked: false, available: false });
      return;
    }

    const timer = setTimeout(() => {
      checkUsername(username, domainId);
    }, 400);

    return () => clearTimeout(timer);
  }, [username, domainId, checkUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    if (!username.trim() || !domainId) {
      setError("Please choose a valid username and domain.");
      return;
    }

    if (!password) {
      setError("Please provide a password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (availability.checked && !availability.available) {
      setError("The chosen email address is not available. Please choose another.");
      return;
    }

    setLoading(true);

    try {
      await api.signup({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        username: username.trim(),
        domainId,
        password,
        dateOfBirth: dateOfBirth || undefined,
        recoveryEmail: recoveryEmail.trim() || undefined,
      });

      // Successful signup automatically logs the user in via session cookies
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const selectedDomain = domains.find((d) => d.id === domainId);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl w-full bg-card border border-border shadow-md rounded-3xl p-6 sm:p-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary mx-auto flex items-center justify-center text-white shadow-lg">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Create your FreeMailo Account
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Sign up for a fast, private, and secure mailbox with custom multi-domain support
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm font-medium text-center animate-in fade-in"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Section: Personal Information */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Personal Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-xs font-semibold text-muted-foreground mb-1"
                >
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="middleName"
                  className="block text-xs font-semibold text-muted-foreground mb-1"
                >
                  Middle Name <span className="text-muted-foreground/60 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  id="middleName"
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Robert"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-xs font-semibold text-muted-foreground mb-1"
                >
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="dateOfBirth"
                  className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Date of Birth <span className="text-muted-foreground/60 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="recoveryEmail"
                  className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Recovery Email <span className="text-muted-foreground/60 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  id="recoveryEmail"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="backup@example.com"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section: Email Address Setup */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5" />
              Choose Your Email Address
            </h2>

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-muted-foreground mb-1"
              >
                Desired Email Address <span className="text-destructive">*</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    placeholder="john.doe"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                </div>

                <div className="flex items-center gap-1 min-w-[200px]">
                  <span className="text-muted-foreground font-semibold text-sm">@</span>
                  <select
                    id="domainId"
                    value={domainId}
                    onChange={(e) => setDomainId(e.target.value)}
                    disabled={domainsLoading || domains.length === 0}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all disabled:opacity-50"
                  >
                    {domains.map((dom) => (
                      <option key={dom.id} value={dom.id}>
                        {dom.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real-time availability indicator badge */}
              <div className="mt-1.5 min-h-[22px] flex items-center text-xs">
                {checkingAvailability && (
                  <span className="text-muted-foreground flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Checking email availability...
                  </span>
                )}

                {!checkingAvailability && availability.checked && (
                  <>
                    {availability.available ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>
                          <strong>{username}@{selectedDomain?.name}</strong> is available!
                        </span>
                      </span>
                    ) : (
                      <span className="text-destructive font-medium flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span>
                          {availability.message || (
                            <><strong>{username}@{selectedDomain?.name}</strong> is already taken.</>
                          )}
                        </span>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section: Password Setup */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Security
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-muted-foreground mb-1"
                >
                  Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-muted-foreground mb-1"
                >
                  Confirm Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                <XCircle className="w-3.5 h-3.5" />
                Passwords do not match
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              (availability.checked && !availability.available) ||
              Boolean(password && confirmPassword && password !== confirmPassword)
            }
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 flex items-center justify-center gap-2 shadow-md hover:shadow transition-all disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating your account...
              </>
            ) : (
              <>
                Create FreeMailo Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-muted-foreground pt-1">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground">
          <span>FreeMailo Self-Hosted Platform</span>
        </div>
      </div>
    </main>
  );
}
