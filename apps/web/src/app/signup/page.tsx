"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  ChevronDown,
  Check,
} from "lucide-react";
import { api, PublicDomain } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Reveal wrapper — each section fades + slides up when `show` flips */
/* ------------------------------------------------------------------ */
function Reveal({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState(0);

  useEffect(() => {
    if (show && ref.current) {
      // measure natural height once visible
      setMaxH(ref.current.scrollHeight + 32);
    }
  }, [show]);

  return (
    <div
      ref={ref}
      style={{
        maxHeight: show ? `${maxH || 600}px` : "0px",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(8px)",
      }}
      className="overflow-hidden transition-all duration-[320ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Signup Page                                                  */
/* ------------------------------------------------------------------ */
export default function SignupPage() {
  const router = useRouter();

  /* ---- Form fields ---- */
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");

  const [username, setUsername] = useState("");
  const [domainId, setDomainId] = useState("");
  const [domains, setDomains] = useState<PublicDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [domainDropdownOpen, setDomainDropdownOpen] = useState(false);
  const domainDropdownRef = useRef<HTMLDivElement>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState("");

  /* ---- Availability ---- */
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availability, setAvailability] = useState<{
    checked: boolean;
    available: boolean;
    email?: string;
    message?: string;
  }>({ checked: false, available: false });

  /* ---- Submission ---- */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /* ---- Track which sections the user has "passed through" ---- */
  const [nameVisited, setNameVisited] = useState(false);

  /* ---- Close domain dropdown on outside click ---- */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        domainDropdownRef.current &&
        !domainDropdownRef.current.contains(event.target as Node)
      ) {
        setDomainDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ---- Fetch available domains ---- */
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
      } catch {
        if (mounted) setError("Failed to load email domains. Please try again later.");
      } finally {
        if (mounted) setDomainsLoading(false);
      }
    }
    loadDomains();
    return () => { mounted = false; };
  }, []);

  /* ---- Debounced availability check ---- */
  const checkUsernameAvailability = useCallback(
    async (uname: string, dId: string) => {
      const clean = uname.trim();
      if (!clean || !dId) {
        setAvailability({ checked: false, available: false });
        return;
      }
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(clean)) {
        setAvailability({
          checked: true,
          available: false,
          message: "Only letters, numbers, dots, hyphens, and underscores allowed.",
        });
        return;
      }
      setCheckingAvailability(true);
      try {
        const res = await api.checkAvailability(clean, dId);
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
          message: err.message || "Failed to verify email availability",
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
      checkUsernameAvailability(username, domainId);
    }, 350);
    return () => clearTimeout(timer);
  }, [username, domainId, checkUsernameAvailability]);

  /* ---- Computed values ---- */
  const selectedDomain = domains.find((d) => d.id === domainId) || domains[0];

  const nameValid = firstName.trim().length >= 1 && lastName.trim().length >= 1;
  const emailValid =
    username.trim().length >= 2 &&
    !checkingAvailability &&
    availability.checked &&
    availability.available;
  const passwordValid =
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    password === confirmPassword;

  // Progressive reveal conditions
  const showDob = nameValid || nameVisited;
  const showEmail = showDob; // DOB is optional so email shows with DOB
  const showPasswordSection = showEmail && emailValid;
  const showRecovery = showPasswordSection && passwordValid;
  const showSubmit = showRecovery;

  /* ---- Password strength ---- */
  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };
  const pwStrength = calculatePasswordStrength(password);
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "bg-destructive",
    "bg-amber-500",
    "bg-blue-500",
    "bg-emerald-500",
  ];

  /* ---- Submit ---- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameValid || !emailValid || !passwordValid) return;

    setError("");
    setSubmitting(true);

    try {
      await api.signup({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        username: username.trim(),
        domainId: domainId || selectedDomain?.id,
        password,
        dateOfBirth: dateOfBirth || undefined,
        recoveryEmail: recoveryEmail.trim() || undefined,
      });
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
      setSubmitting(false);
    }
  };

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border shadow-sm rounded-3xl p-8 sm:p-10 space-y-6">
        {/* ── Brand Header (matches login) ── */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary mx-auto flex items-center justify-center text-white shadow-lg">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create your FreeMailo account
          </h1>
          <p className="text-xs text-muted-foreground">
            Get a fast, secure email address
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-center animate-in fade-in"
          >
            {error}
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-0">
          {/* ─── Section 1 : Name ─── */}
          <div className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  First name <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="firstName"
                    type="text"
                    required
                    autoFocus
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onBlur={() => { if (nameValid) setNameVisited(true); }}
                    placeholder="David"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Last name <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onBlur={() => { if (nameValid) setNameVisited(true); }}
                    placeholder="Smith"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Middle name — optional, inline */}
            <div>
              <label
                htmlFor="middleName"
                className="block text-xs font-semibold text-muted-foreground mb-1.5"
              >
                Middle name{" "}
                <span className="font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <input
                id="middleName"
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                onBlur={() => { if (nameValid) setNameVisited(true); }}
                placeholder="Robert"
                className="w-full h-11 px-4 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
              />
            </div>
          </div>

          {/* ─── Section 2 : Date of Birth (optional) ─── */}
          <Reveal show={showDob}>
            <div className="pb-4">
              <label
                htmlFor="dateOfBirth"
                className="block text-xs font-semibold text-muted-foreground mb-1.5"
              >
                Date of birth{" "}
                <span className="font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                />
              </div>
            </div>
          </Reveal>

          {/* ─── Section 3 : Email Address ─── */}
          <Reveal show={showEmail}>
            <div className="pb-4 space-y-2">
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-muted-foreground mb-1.5"
              >
                Choose your email <span className="text-destructive">*</span>
              </label>

              {/* Unified email input row */}
              <div
                ref={domainDropdownRef}
                className="relative flex items-center h-12 w-full rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all"
              >
                {/* Username input */}
                <input
                  id="username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, ""),
                    )
                  }
                  placeholder="username"
                  className="bg-transparent border-0 h-full pl-4 pr-1 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 flex-1 min-w-0"
                />

                {/* Domain badge + switcher */}
                <div className="relative shrink-0 flex items-center pr-2">
                  <button
                    type="button"
                    onClick={() => setDomainDropdownOpen(!domainDropdownOpen)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground text-xs sm:text-sm transition-colors select-none"
                    title="Switch domain"
                  >
                    <span className="text-muted-foreground/60 font-medium">
                      @{selectedDomain?.name || "example.com"}
                    </span>
                    {domains.length > 1 && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          domainDropdownOpen ? "rotate-180 text-primary" : ""
                        }`}
                      />
                    )}
                  </button>

                  {/* Domain dropdown */}
                  {domainDropdownOpen && domains.length > 1 && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 max-h-52 overflow-y-auto rounded-xl bg-popover border border-border shadow-lg p-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                      {domains.map((dom) => {
                        const isSelected = dom.id === domainId;
                        return (
                          <button
                            key={dom.id}
                            type="button"
                            onClick={() => {
                              setDomainId(dom.id);
                              setDomainDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-secondary"
                            }`}
                          >
                            <span className="truncate">@{dom.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Availability feedback */}
              <div className="min-h-[22px] flex items-center text-xs pl-1">
                {checkingAvailability && (
                  <span className="text-muted-foreground flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    Checking availability…
                  </span>
                )}
                {!checkingAvailability && availability.checked && (
                  <>
                    {availability.available ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {username}@{selectedDomain?.name} is available
                      </span>
                    ) : (
                      <span className="text-destructive font-medium flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" />
                        {availability.message ||
                          `${username}@${selectedDomain?.name} is already taken`}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </Reveal>

          {/* ─── Section 4 : Password ─── */}
          <Reveal show={showPasswordSection}>
            <div className="pb-4 space-y-3">
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full h-11 pl-10 pr-11 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  >
                    {passwordVisible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Strength meter */}
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1 h-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            i < pwStrength
                              ? strengthColors[pwStrength - 1] || "bg-primary"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {strengthLabels[pwStrength - 1] || "Too short"} · min 8 characters
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Confirm password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="confirmPassword"
                    type={confirmPasswordVisible ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full h-11 pl-10 pr-11 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  >
                    {confirmPasswordVisible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {password && confirmPassword && (
                  <div className="mt-1.5 text-xs pl-1">
                    {password === confirmPassword ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-destructive font-medium flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Reveal>

          {/* ─── Section 5 : Recovery Email ─── */}
          <Reveal show={showRecovery}>
            <div className="pb-4">
              <label
                htmlFor="recoveryEmail"
                className="block text-xs font-semibold text-muted-foreground mb-1.5"
              >
                Recovery email{" "}
                <span className="font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="recoveryEmail"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="backup@example.com"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground pl-1">
                Used for security notifications and password resets
              </p>
            </div>
          </Reveal>

          {/* ─── Submit ─── */}
          <Reveal show={showSubmit}>
            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting || !nameValid || !emailValid || !passwordValid}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 flex items-center justify-center gap-2 shadow-md hover:shadow transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </Reveal>
        </form>

        {/* ── Footer ── */}
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
