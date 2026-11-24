"use client";

import React, { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { StepProps } from "../types";
import { StepHeader } from "../StepHeader";
import { StaggerField } from "../StepTransition";
import {
  calculatePasswordStrength,
  validatePassword,
  validateConfirmPassword,
} from "../validators";

const STRENGTH_LABELS = ["Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = [
  "bg-destructive",
  "bg-amber-500",
  "bg-blue-500",
  "bg-emerald-500",
];

export function PasswordStep({
  data,
  onChange,
  errors,
  setFieldError,
  onNext,
}: StepProps) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      passwordRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      onNext();
    }
  };

  const pwStrength = calculatePasswordStrength(data.password);
  const isMatching = Boolean(
    data.password && data.confirmPassword && data.password === data.confirmPassword,
  );
  const isMismatch = Boolean(
    data.password && data.confirmPassword && data.password !== data.confirmPassword,
  );

  return (
    <div className="w-full">
      <StepHeader
        title="Create a strong password"
        subtitle="Create a strong password with a mix of letters, numbers and symbols"
      />

      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <StaggerField>
          <div className="min-w-0">
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                ref={passwordRef}
                id="password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="new-password"
                required
                value={data.password}
                onChange={(e) => {
                  onChange({ password: e.target.value });
                  if (errors.password) {
                    const res = validatePassword(e.target.value);
                    setFieldError("password", res.isValid ? undefined : res.error);
                  }
                  if (data.confirmPassword && errors.confirmPassword) {
                    const matchRes = validateConfirmPassword(e.target.value, data.confirmPassword);
                    setFieldError("confirmPassword", matchRes.isValid ? undefined : matchRes.error);
                  }
                }}
                placeholder="At least 8 characters"
                aria-invalid={!!errors.password}
                aria-describedby="password-strength"
                className={`signup-input pr-12 ${
                  errors.password
                    ? "!border-destructive focus:!border-destructive focus:!ring-destructive/20"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible(!passwordVisible)}
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                aria-pressed={passwordVisible}
                className="signup-password-toggle"
              >
                {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {errors.password && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.password}
              </p>
            )}

            <div className="mt-2 space-y-1.5" id="password-strength">
              <div className="flex h-1 gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`flex-1 rounded-full transition-colors duration-200 ${
                      index < pwStrength
                        ? STRENGTH_COLORS[pwStrength - 1] || "bg-primary"
                        : "bg-secondary"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.password
                  ? `${STRENGTH_LABELS[pwStrength - 1] || "Too short"} · `
                  : ""}
                Use 8 or more characters with a mix of letters, numbers & symbols.
              </p>
            </div>
          </div>
        </StaggerField>

        <StaggerField>
          <div className="min-w-0">
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={confirmPasswordVisible ? "text" : "password"}
                autoComplete="new-password"
                required
                value={data.confirmPassword}
                onChange={(e) => {
                  onChange({ confirmPassword: e.target.value });
                  if (errors.confirmPassword || errors.password) {
                    const res = validateConfirmPassword(data.password, e.target.value);
                    setFieldError("confirmPassword", res.isValid ? undefined : res.error);
                  }
                }}
                placeholder="Re-enter password"
                aria-invalid={!!errors.confirmPassword || isMismatch}
                aria-describedby="password-match"
                className={`signup-input pr-12 ${
                  errors.confirmPassword || isMismatch
                    ? "!border-destructive focus:!border-destructive focus:!ring-destructive/20"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                aria-label={
                  confirmPasswordVisible
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                aria-pressed={confirmPasswordVisible}
                className="signup-password-toggle"
              >
                {confirmPasswordVisible ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>

            <p
              id="password-match"
              role="status"
              aria-live="polite"
              className={`mt-1.5 min-h-5 text-xs ${
                isMatching
                  ? "text-primary"
                  : errors.confirmPassword || isMismatch
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {errors.confirmPassword
                ? errors.confirmPassword
                : isMatching
                ? "Passwords match"
                : isMismatch
                ? "Passwords do not match"
                : ""}
            </p>
          </div>
        </StaggerField>
      </div>
    </div>
  );
}
