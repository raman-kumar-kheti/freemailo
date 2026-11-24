"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { api, PublicDomain } from "@/lib/api";
import { StepTransition } from "./StepTransition";
import { SignupFormData, StepNumber, AvailabilityState } from "./types";
import {
  validateFirstName,
  validateLastName,
  validateDateOfBirth,
  validateUsername,
  validatePassword,
  validateConfirmPassword,
  validateRecoveryEmail,
} from "./validators";

import { NameStep } from "./steps/NameStep";
import { BirthdayStep } from "./steps/BirthdayStep";
import { EmailStep } from "./steps/EmailStep";
import { PasswordStep } from "./steps/PasswordStep";
import { RecoveryStep } from "./steps/RecoveryStep";
import { ReviewStep } from "./steps/ReviewStep";

const initialFormData: SignupFormData = {
  firstName: "",
  middleName: "",
  lastName: "",
  dob: "",
  username: "",
  domain: "",
  password: "",
  confirmPassword: "",
  recoveryEmail: "",
};

export function SignupWizard() {
  const router = useRouter();

  /* Form & Step state */
  const [formData, setFormData] = useState<SignupFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [direction, setDirection] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>("");

  /* Domains */
  const [domains, setDomains] = useState<PublicDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);

  /* Username availability */
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState>({
    checked: false,
    available: false,
  });

  /* Submission */
  const [submitting, setSubmitting] = useState(false);

  /* Load domains */
  useEffect(() => {
    let mounted = true;
    async function loadDomains() {
      try {
        setDomainsLoading(true);
        const res = await api.getPublicDomains();
        if (mounted && res?.data?.length > 0) {
          setDomains(res.data);
          setFormData((prev) => ({
            ...prev,
            domain: prev.domain || res.data[0].id,
          }));
        }
      } catch {
        if (mounted) {
          setServerError("Failed to load email domains. Please try again later.");
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

  /* Check username availability */
  const checkUsernameAvailability = useCallback(
    async (uname: string, dId: string): Promise<boolean> => {
      const clean = uname.trim();
      if (!clean || !dId) {
        setAvailability({ checked: false, available: false });
        return false;
      }

      const formatValidation = validateUsername(clean);
      if (!formatValidation.isValid) {
        setAvailability({
          checked: true,
          available: false,
          message: formatValidation.error,
        });
        return false;
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
        return res.available;
      } catch (err: any) {
        setAvailability({
          checked: true,
          available: false,
          message: err.message || "Failed to verify email availability",
        });
        return false;
      } finally {
        setCheckingAvailability(false);
      }
    },
    [],
  );

  /* Debounced check when username or domain changes */
  useEffect(() => {
    if (!formData.username.trim() || !formData.domain) {
      setAvailability({ checked: false, available: false });
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(formData.username, formData.domain);
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.username, formData.domain, checkUsernameAvailability]);

  /* State updater */
  const updateFormData = (fields: Partial<SignupFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const setFieldError = (field: string, message?: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  /* Step navigation */
  const goToStep = (step: StepNumber, dir?: number) => {
    setDirection(dir !== undefined ? dir : step > currentStep ? 1 : -1);
    setCurrentStep(step);
    setServerError("");
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep((currentStep - 1) as StepNumber, -1);
    }
  };

  const selectedDomain =
    domains.find((d) => d.id === formData.domain) || domains[0];
  const newEmailAddress =
    formData.username && selectedDomain?.name
      ? `${formData.username}@${selectedDomain.name}`
      : undefined;

  /* Validation per step */
  const validateCurrentStep = async (): Promise<boolean> => {
    const newErrors: Record<string, string | undefined> = {};

    if (currentStep === 1) {
      const firstRes = validateFirstName(formData.firstName);
      if (!firstRes.isValid) newErrors.firstName = firstRes.error;

      const lastRes = validateLastName(formData.lastName);
      if (!lastRes.isValid) newErrors.lastName = lastRes.error;

      if (Object.keys(newErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...newErrors }));
        if (newErrors.firstName) {
          document.getElementById("firstName")?.focus();
        } else if (newErrors.lastName) {
          document.getElementById("lastName")?.focus();
        }
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      const dobRes = validateDateOfBirth(formData.dob);
      if (!dobRes.isValid) {
        setFieldError("dob", dobRes.error);
        document.getElementById("dob")?.focus();
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      const usernameRes = validateUsername(formData.username);
      if (!usernameRes.isValid) {
        setFieldError("username", usernameRes.error);
        document.getElementById("username")?.focus();
        return false;
      }

      // Check availability if not yet verified
      if (!availability.checked || checkingAvailability) {
        const available = await checkUsernameAvailability(
          formData.username,
          formData.domain || selectedDomain?.id,
        );
        if (!available) {
          setFieldError("username", "This username is not available");
          document.getElementById("username")?.focus();
          return false;
        }
      } else if (!availability.available) {
        setFieldError(
          "username",
          availability.message || "This username is not available",
        );
        document.getElementById("username")?.focus();
        return false;
      }

      return true;
    }

    if (currentStep === 4) {
      const pwRes = validatePassword(formData.password);
      if (!pwRes.isValid) newErrors.password = pwRes.error;

      const confirmRes = validateConfirmPassword(
        formData.password,
        formData.confirmPassword,
      );
      if (!confirmRes.isValid) newErrors.confirmPassword = confirmRes.error;

      if (Object.keys(newErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...newErrors }));
        if (newErrors.password) {
          document.getElementById("password")?.focus();
        } else if (newErrors.confirmPassword) {
          document.getElementById("confirmPassword")?.focus();
        }
        return false;
      }
      return true;
    }

    if (currentStep === 5) {
      const recoveryRes = validateRecoveryEmail(
        formData.recoveryEmail,
        newEmailAddress,
      );
      if (!recoveryRes.isValid) {
        setFieldError("recoveryEmail", recoveryRes.error);
        document.getElementById("recoveryEmail")?.focus();
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < 6) {
      goToStep((currentStep + 1) as StepNumber, 1);
    }
  };

  const handleSkip = () => {
    if (currentStep === 2) {
      setFieldError("dob", undefined);
      goToStep(3, 1);
    } else if (currentStep === 5) {
      setFieldError("recoveryEmail", undefined);
      goToStep(6, 1);
    }
  };

  /* Final submission */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (currentStep < 6) {
      handleNext();
      return;
    }

    setServerError("");
    setSubmitting(true);

    try {
      await api.signup({
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim() || undefined,
        lastName: formData.lastName.trim(),
        username: formData.username.trim(),
        domainId: formData.domain || selectedDomain?.id,
        password: formData.password,
        dateOfBirth: formData.dob || undefined,
        recoveryEmail: formData.recoveryEmail.trim() || undefined,
      });
      router.push("/");
    } catch (err: any) {
      const errMsg = err?.message || "Failed to create account. Please try again.";
      const lower = errMsg.toLowerCase();

      // Send user back to relevant step on domain/server errors
      if (
        lower.includes("username") ||
        lower.includes("taken") ||
        lower.includes("email") ||
        lower.includes("mailbox") ||
        lower.includes("localpart")
      ) {
        setFieldError("username", errMsg);
        goToStep(3, -1);
      } else if (lower.includes("password")) {
        setFieldError("password", errMsg);
        goToStep(4, -1);
      } else if (lower.includes("name")) {
        setFieldError("firstName", errMsg);
        goToStep(1, -1);
      } else if (lower.includes("recovery")) {
        setFieldError("recoveryEmail", errMsg);
        goToStep(5, -1);
      } else {
        setServerError(errMsg);
      }
      setSubmitting(false);
    }
  };

  const stepProps = {
    data: formData,
    onChange: updateFormData,
    errors,
    setFieldError,
    onNext: handleNext,
    direction,
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:py-12 flex flex-col justify-center items-center">
      <motion.div
        layout
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="auth-card relative w-full max-w-[448px] rounded-3xl border bg-card p-6 shadow-sm sm:p-8"
      >
        <form onSubmit={handleSubmit} noValidate>
          <StepTransition
            stepKey={currentStep}
            direction={direction}
          >
            {currentStep === 1 && <NameStep {...stepProps} />}
            {currentStep === 2 && (
              <BirthdayStep {...stepProps} onSkip={handleSkip} />
            )}
            {currentStep === 3 && (
              <EmailStep
                {...stepProps}
                domains={domains}
                domainsLoading={domainsLoading}
                availability={availability}
                checkingAvailability={checkingAvailability}
              />
            )}
            {currentStep === 4 && <PasswordStep {...stepProps} />}
            {currentStep === 5 && (
              <RecoveryStep
                {...stepProps}
                onSkip={handleSkip}
                domains={domains}
              />
            )}
            {currentStep === 6 && (
              <ReviewStep
                data={formData}
                domains={domains}
                onEditStep={(step) => goToStep(step, -1)}
                serverError={serverError}
              />
            )}
          </StepTransition>

          {/* Footer Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-border/70 pt-5">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {currentStep === 6 ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="primary-button min-h-10 px-6"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      Creating account…
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  className="primary-button min-h-10 px-6"
                >
                  Next
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </form>

        {currentStep === 1 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-border/60 pt-5 text-xs text-muted-foreground">
          <ShieldCheck size={14} aria-hidden="true" />
          FreeMailo Self-Hosted Platform
        </div>
      </motion.div>
    </main>
  );
}
