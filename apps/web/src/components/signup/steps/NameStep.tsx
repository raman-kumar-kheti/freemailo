"use client";

import React, { useEffect, useRef } from "react";
import { StepProps } from "../types";
import { StepHeader } from "../StepHeader";
import { StaggerField } from "../StepTransition";
import { validateFirstName, validateLastName } from "../validators";

export function NameStep({
  data,
  onChange,
  errors,
  setFieldError,
  onNext,
}: StepProps) {
  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus first input on mount / enter
    const timer = setTimeout(() => {
      firstNameRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div className="w-full">
      <StepHeader
        title="Create your FreeMailo account"
        subtitle="Enter your name"
      />

      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <StaggerField>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label
                htmlFor="firstName"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                First name
              </label>
              <input
                ref={firstNameRef}
                id="firstName"
                type="text"
                autoComplete="given-name"
                required
                value={data.firstName}
                onChange={(e) => {
                  onChange({ firstName: e.target.value });
                  if (errors.firstName) {
                    const res = validateFirstName(e.target.value);
                    setFieldError("firstName", res.isValid ? undefined : res.error);
                  }
                }}
                placeholder="David"
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? "firstName-error" : undefined}
                className={`signup-input ${
                  errors.firstName
                    ? "!border-destructive focus:!border-destructive focus:!ring-destructive/20"
                    : ""
                }`}
              />
              {errors.firstName && (
                <p
                  id="firstName-error"
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.firstName}
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label
                htmlFor="lastName"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                required
                value={data.lastName}
                onChange={(e) => {
                  onChange({ lastName: e.target.value });
                  if (errors.lastName) {
                    const res = validateLastName(e.target.value);
                    setFieldError("lastName", res.isValid ? undefined : res.error);
                  }
                }}
                placeholder="Smith"
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? "lastName-error" : undefined}
                className={`signup-input ${
                  errors.lastName
                    ? "!border-destructive focus:!border-destructive focus:!ring-destructive/20"
                    : ""
                }`}
              />
              {errors.lastName && (
                <p
                  id="lastName-error"
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>
        </StaggerField>

        <StaggerField>
          <div className="min-w-0">
            <label
              htmlFor="middleName"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Middle name{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              id="middleName"
              type="text"
              autoComplete="additional-name"
              value={data.middleName}
              onChange={(e) => onChange({ middleName: e.target.value })}
              placeholder="Robert"
              className="signup-input"
            />
          </div>
        </StaggerField>
      </div>
    </div>
  );
}
