"use client";

import React, { useEffect, useRef } from "react";
import { StepProps } from "../types";
import { StepHeader } from "../StepHeader";
import { StaggerField } from "../StepTransition";
import { validateRecoveryEmail } from "../validators";
import { PublicDomain } from "@/lib/api";

interface RecoveryStepProps extends StepProps {
  onSkip: () => void;
  domains: PublicDomain[];
}

export function RecoveryStep({
  data,
  onChange,
  errors,
  setFieldError,
  onNext,
  onSkip,
  domains,
}: RecoveryStepProps) {
  const recoveryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      recoveryRef.current?.focus();
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
  const newEmail = data.username && selectedDomain?.name
    ? `${data.username}@${selectedDomain.name}`
    : undefined;

  return (
    <div className="w-full">
      <StepHeader
        title="Add a recovery email"
        subtitle="For security notifications and password resets"
      />

      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <StaggerField>
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="recoveryEmail"
                className="block text-sm font-medium text-foreground"
              >
                Recovery email{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <button
                type="button"
                onClick={onSkip}
                className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
              >
                Skip
              </button>
            </div>

            <input
              ref={recoveryRef}
              id="recoveryEmail"
              type="email"
              autoComplete="email"
              value={data.recoveryEmail}
              onChange={(e) => {
                onChange({ recoveryEmail: e.target.value });
                if (errors.recoveryEmail) {
                  const res = validateRecoveryEmail(e.target.value, newEmail);
                  setFieldError("recoveryEmail", res.isValid ? undefined : res.error);
                }
              }}
              placeholder="backup@example.com"
              aria-invalid={!!errors.recoveryEmail}
              aria-describedby={
                errors.recoveryEmail ? "recovery-error" : "recovery-hint"
              }
              className={`signup-input ${
                errors.recoveryEmail
                  ? "!border-destructive focus:!border-destructive focus:!ring-destructive/20"
                  : ""
              }`}
            />

            {errors.recoveryEmail ? (
              <p
                id="recovery-error"
                role="alert"
                className="mt-1.5 text-xs text-destructive"
              >
                {errors.recoveryEmail}
              </p>
            ) : (
              <p
                id="recovery-hint"
                className="mt-1.5 text-xs text-muted-foreground"
              >
                An address where we can contact you if you lose access to your account.
              </p>
            )}
          </div>
        </StaggerField>
      </div>
    </div>
  );
}
