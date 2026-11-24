"use client";

import React from "react";
import { User, Mail, Calendar, Shield, LifeBuoy, Pencil } from "lucide-react";
import { SignupFormData, StepNumber } from "../types";
import { PublicDomain } from "@/lib/api";
import { StepHeader } from "../StepHeader";
import { StaggerField } from "../StepTransition";

interface ReviewStepProps {
  data: SignupFormData;
  domains: PublicDomain[];
  onEditStep: (step: StepNumber) => void;
  serverError?: string;
}

export function ReviewStep({
  data,
  domains,
  onEditStep,
  serverError,
}: ReviewStepProps) {
  const selectedDomain =
    domains.find((d) => d.id === data.domain) || domains[0];
  const fullEmail = `${data.username}@${selectedDomain?.name || "example.test"}`;

  const fullName = [data.firstName, data.middleName, data.lastName]
    .filter(Boolean)
    .join(" ");

  const formatDob = (dobStr: string) => {
    if (!dobStr) return "Not provided";
    try {
      const [year, month, day] = dobStr.split("-");
      if (year && month && day) {
        return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(
          undefined,
          { year: "numeric", month: "long", day: "numeric" }
        );
      }
      return dobStr;
    } catch {
      return dobStr;
    }
  };

  const reviewItems = [
    {
      step: 1 as StepNumber,
      icon: User,
      label: "Name",
      value: fullName || "—",
    },
    {
      step: 3 as StepNumber,
      icon: Mail,
      label: "Email address",
      value: fullEmail,
      highlight: true,
    },
    {
      step: 2 as StepNumber,
      icon: Calendar,
      label: "Date of birth",
      value: formatDob(data.dob),
    },
    {
      step: 4 as StepNumber,
      icon: Shield,
      label: "Password",
      value: "••••••••",
    },
    {
      step: 5 as StepNumber,
      icon: LifeBuoy,
      label: "Recovery email",
      value: data.recoveryEmail ? data.recoveryEmail.trim() : "Not provided",
    },
  ];

  return (
    <div className="w-full">
      <StepHeader
        title="Review and create"
        subtitle="Confirm your account details before creating your account"
      />

      <div className="space-y-4">
        {serverError && (
          <StaggerField>
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          </StaggerField>
        )}

        <StaggerField>
          <div className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card/60 p-1">
            {reviewItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 first:pt-2.5 last:pb-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Icon size={16} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p
                        className={`truncate text-sm font-medium ${
                          item.highlight ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {item.value}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEditStep(item.step)}
                    aria-label={`Edit ${item.label}`}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <Pencil size={12} aria-hidden="true" />
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
        </StaggerField>
      </div>
    </div>
  );
}
