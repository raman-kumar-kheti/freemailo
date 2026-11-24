"use client";

import React from "react";
import { StepNumber } from "./types";

interface StepIndicatorProps {
  currentStep: StepNumber;
  totalSteps?: number;
}

const STEP_TITLES: Record<StepNumber, string> = {
  1: "Name",
  2: "Birthday",
  3: "Email",
  4: "Password",
  5: "Recovery",
  6: "Review",
};

export function StepIndicator({
  currentStep,
  totalSteps = 6,
}: StepIndicatorProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full space-y-2 mb-6" aria-label="Sign up progress">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span aria-current="step" className="text-foreground font-semibold">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-muted-foreground">
          {STEP_TITLES[currentStep]}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Step ${currentStep} of ${totalSteps}: ${STEP_TITLES[currentStep]}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80"
      >
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
