"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Lock,
  User,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import { api, PublicDomain } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function SignupField({
  label,
  optional,
  children,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  optional?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={props.id} className="mb-1.5 block text-sm font-medium">
        {label}{" "}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>
      <div className="relative">
        <input
          {...props}
          className={`signup-input ${children ? "pr-12" : ""}`}
        />
        {children}
      </div>
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
        if (mounted)
          setError("Failed to load email domains. Please try again later.");
      } finally {
        if (mounted) setDomainsLoading(false);
      }
    }
    loadDomains();
    return () => {
      mounted = false;
    };
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
          message:
            "Only letters, numbers, dots, hyphens, and underscores allowed.",
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

  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:py-12">
      <div className="auth-card relative mx-auto w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="mb-7 space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Mail size={25} aria-hidden="true" />
          </div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight">
            Create your FreeMailo account
          </h1>
          <p className="text-sm text-muted-foreground">
            Your own email address. A fresh start.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          aria-busy={submitting}
        >
          <fieldset className="min-w-0 space-y-4">
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <User size={16} className="text-primary" aria-hidden="true" />{" "}
              About you
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <SignupField
                id="firstName"
                label="First name"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="David"
              />
              <SignupField
                id="lastName"
                label="Last name"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>
            <SignupField
              id="middleName"
              label="Middle name"
              optional
              autoComplete="additional-name"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Robert"
            />
            <SignupField
              id="dateOfBirth"
              label="Date of birth"
              optional
              type="date"
              autoComplete="bday"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </fieldset>

          <fieldset className="min-w-0 border-t pt-5">
            <legend className="sr-only">Email address</legend>
            <label
              htmlFor="username"
              className="mb-2 flex items-center gap-2 text-sm font-semibold"
            >
              <Mail size={16} className="text-primary" aria-hidden="true" />{" "}
              Choose your email
            </label>
            <div className="flex min-w-0 items-center rounded-xl border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-zA-Z0-9._-]/g, ""),
                  )
                }
                aria-describedby="email-feedback"
                placeholder="username"
                className="h-12 w-full min-w-0 flex-1 rounded-l-xl bg-transparent pl-3 pr-1 text-sm outline-none"
              />
              <div className="relative max-w-[58%] shrink-0">
                <label htmlFor="signup-domain" className="sr-only">
                  Email domain
                </label>
                <select
                  id="signup-domain"
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value)}
                  disabled={domainsLoading || domains.length < 2}
                  className="h-11 w-full appearance-none truncate rounded-xl bg-transparent pl-2 pr-8 text-sm text-muted-foreground disabled:opacity-100"
                >
                  {!domains.length && (
                    <option value="">
                      {domainsLoading ? "Loading…" : "No domains"}
                    </option>
                  )}
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      @{domain.name}
                    </option>
                  ))}
                </select>
                {domains.length > 1 && (
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                )}
              </div>
            </div>
            <div
              id="email-feedback"
              role="status"
              aria-live="polite"
              className="mt-2 min-h-10 break-words text-xs leading-5"
            >
              {checkingAvailability ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2
                    size={14}
                    aria-hidden="true"
                    className="animate-spin"
                  />
                  Checking availability…
                </span>
              ) : availability.checked ? (
                availability.available ? (
                  <span className="flex items-start gap-1.5 text-primary">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {username}@{selectedDomain?.name} is available
                    </span>
                  </span>
                ) : (
                  <span className="flex items-start gap-1.5 text-destructive">
                    <XCircle
                      size={14}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {availability.message ||
                        `${username}@${selectedDomain?.name} is already taken`}
                    </span>
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">
                  Letters, numbers, dots, hyphens and underscores.
                </span>
              )}
            </div>
          </fieldset>

          <fieldset className="min-w-0 space-y-4 border-t pt-5">
            <legend className="sr-only">Password</legend>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock size={16} className="text-primary" aria-hidden="true" />{" "}
              Keep your account secure
            </div>
            <div>
              <SignupField
                id="password"
                label="Password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                aria-describedby="password-strength"
              >
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  aria-label={
                    passwordVisible ? "Hide password" : "Show password"
                  }
                  aria-pressed={passwordVisible}
                  className="signup-password-toggle"
                >
                  {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </SignupField>
              <div className="mt-2 space-y-1.5" id="password-strength">
                <div className="flex h-1 gap-1" aria-hidden="true">
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={`flex-1 rounded-full ${index < pwStrength ? strengthColors[pwStrength - 1] || "bg-primary" : "bg-secondary"}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {password
                    ? `${strengthLabels[pwStrength - 1] || "Too short"} · `
                    : ""}
                  Use at least 8 characters.
                </p>
              </div>
            </div>
            <div>
              <SignupField
                id="confirmPassword"
                label="Confirm password"
                type={confirmPasswordVisible ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                aria-describedby="password-match"
              >
                <button
                  type="button"
                  onClick={() =>
                    setConfirmPasswordVisible(!confirmPasswordVisible)
                  }
                  aria-label={
                    confirmPasswordVisible
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  aria-pressed={confirmPasswordVisible}
                  className="signup-password-toggle"
                >
                  {confirmPasswordVisible ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </SignupField>
              <p
                id="password-match"
                role="status"
                className={`mt-2 min-h-5 text-xs ${password === confirmPassword ? "text-primary" : "text-destructive"}`}
              >
                {password && confirmPassword
                  ? password === confirmPassword
                    ? "Passwords match"
                    : "Passwords do not match"
                  : ""}
              </p>
            </div>
          </fieldset>

          <div className="border-t pt-5">
            <SignupField
              id="recoveryEmail"
              label="Recovery email"
              optional
              type="email"
              autoComplete="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="backup@example.com"
              aria-describedby="recovery-hint"
            />
            <p
              id="recovery-hint"
              className="mt-2 text-xs leading-5 text-muted-foreground"
            >
              For security notifications and password resets.
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !nameValid || !emailValid || !passwordValid}
            className="primary-button min-h-12 w-full"
          >
            {submitting ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Creating account…
              </>
            ) : (
              <>
                Create account
                <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
        <div className="mt-6 flex items-center justify-center gap-1.5 border-t pt-5 text-xs text-muted-foreground">
          <ShieldCheck size={14} aria-hidden="true" />
          FreeMailo Self-Hosted Platform
        </div>
      </div>
    </main>
  );
}
