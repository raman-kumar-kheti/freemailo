"use client";

import React, { useEffect, useRef } from "react";
import { StepProps } from "../types";
import { StepHeader } from "../StepHeader";
import { StaggerField } from "../StepTransition";
import { validateDateOfBirth } from "../validators";

interface BirthdayStepProps extends StepProps {
  onSkip: () => void;
}

export function BirthdayStep({
  data,
  onChange,
  errors,
  setFieldError,
  onNext,
  onSkip,
}: BirthdayStepProps) {
  const dobRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      dobRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      onNext();
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="w-full">
      <StepHeader
        title="Basic information"
        subtitle="Enter your date of birth"
      />

      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <StaggerField>
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="dob"
                className="block text-sm font-medium text-foreground"
              >
                Date of birth{" "}
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
              ref={dobRef}
              id="dob"
              type="date"
              autoComplete="bday"
              max={todayStr}
              value={data.dob}
              onChange={(e) => {
                onChange({ dob: e.target.value });
                if (errors.dob) {
                  const res = validateDateOfBirth(e.target.value);
                  setFieldError("dob", res.isValid ? undefined : res.error);
                }
              }}
              aria-invalid={!!errors.dob}
              aria-describedby={
                errors.dob ? "dob-error" : "dob-hint"
              }
              className={`signup-input ${
                errors.dob
                  ? "!border-destructive focus:!border-destructive focus:!ring-destructive/20"
                  : ""
              }`}
            />
            {errors.dob ? (
              <p
                id="dob-error"
                role="alert"
                className="mt-1.5 text-xs text-destructive"
              >
                {errors.dob}
              </p>
            ) : (
              <p
                id="dob-hint"
                className="mt-1.5 text-xs text-muted-foreground"
              >
                FreeMailo accounts require account holders to be at least 13 years old.
              </p>
            )}
          </div>
        </StaggerField>
      </div>
    </div>
  );
}
