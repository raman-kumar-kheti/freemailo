"use client";

import React, { useEffect, useRef } from "react";
import { ChevronDown, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { StepProps, AvailabilityState } from "../types";
import { PublicDomain } from "@/lib/api";
import { StepHeader } from "../StepHeader";
import { StaggerField } from "../StepTransition";
import { validateUsername } from "../validators";

interface EmailStepProps extends StepProps {
  domains: PublicDomain[];
  domainsLoading: boolean;
  availability: AvailabilityState;
  checkingAvailability: boolean;
}

export function EmailStep({
  data,
  onChange,
  errors,
  setFieldError,
  onNext,
  domains,
  domainsLoading,
  availability,
  checkingAvailability,
}: EmailStepProps) {
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      usernameRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      onNext();
    }
  };

  const selectedDomain =
    domains.find((d) => d.id === data.domain) || domains[0];

  const hasError = !!errors.username || (availability.checked && !availability.available);
  const errorMessage = errors.username || availability.message || "This username is not available";

  return (
    <div className="w-full">
      <StepHeader
        title="Choose your email address"
        subtitle="Create a username for your new email"
      />

      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <StaggerField>
          <div className="min-w-0">
            <label
              htmlFor="username"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Username
            </label>
            <div
              className={`flex min-w-0 items-center rounded-xl border bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
                hasError
                  ? "!border-destructive focus-within:!border-destructive focus-within:!ring-destructive/20"
                  : "border-input"
              }`}
            >
              <input
                ref={usernameRef}
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={data.username}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, "");
                  onChange({ username: val });
                  if (errors.username) {
                    const res = validateUsername(val);
                    setFieldError("username", res.isValid ? undefined : res.error);
                  }
                }}
                aria-invalid={hasError}
                aria-describedby="email-feedback"
                placeholder="username"
                className="h-11 w-full min-w-0 flex-1 rounded-l-xl bg-transparent pl-3 pr-1 text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="relative max-w-[58%] shrink-0 border-l border-border/60">
                <label htmlFor="signup-domain" className="sr-only">
                  Email domain
                </label>
                <select
                  id="signup-domain"
                  value={data.domain}
                  onChange={(e) => onChange({ domain: e.target.value })}
                  disabled={domainsLoading || domains.length < 2}
                  className="h-11 w-full appearance-none truncate rounded-r-xl bg-transparent pl-2 pr-8 text-sm text-muted-foreground disabled:opacity-100"
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
              className="mt-2 min-h-6 break-words text-xs leading-5"
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
              ) : hasError ? (
                <span className="flex items-start gap-1.5 text-destructive">
                  <XCircle
                    size={14}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{errorMessage}</span>
                </span>
              ) : availability.checked && availability.available ? (
                <span className="flex items-start gap-1.5 text-primary">
                  <CheckCircle2
                    size={14}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {data.username}@{selectedDomain?.name} is available
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Use 3–30 letters, numbers, periods, hyphens, and underscores.
                </span>
              )}
            </div>
          </div>
        </StaggerField>
      </div>
    </div>
  );
}
