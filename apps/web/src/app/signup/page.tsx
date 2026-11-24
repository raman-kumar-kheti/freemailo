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
  ArrowLeft,
  Eye,
  EyeOff,
  AtSign,
  ChevronDown,
  Check,
  Sparkles,
} from "lucide-react";
import { api, PublicDomain } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TOTAL_STEPS = 5;

const STEP_METADATA = [
  {
    step: 1,
    title: "What's your name?",
    subtitle: "Enter your full name to get started.",
    icon: User,
    label: "Name",
  },
  {
    step: 2,
    title: "When's your birthday?",
    subtitle: "Helps us provide age-appropriate settings and recovery verification.",
    icon: Calendar,
    label: "Birthday",
  },
  {
    step: 3,
    title: "Choose your email address",
    subtitle: "Pick a unique username and choose your favorite domain.",
    icon: AtSign,
    label: "Email",
  },
  {
    step: 4,
    title: "Set your password",
    subtitle: "Create a strong password with at least 8 characters.",
    icon: Lock,
    label: "Security",
  },
  {
    step: 5,
    title: "Recovery email & review",
    subtitle: "Add an optional backup email and confirm your details.",
    icon: ShieldCheck,
    label: "Confirm",
  },
];

export default function SignupPage() {
  const router = useRouter();

  // Wizard Navigation
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Form Fields
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState("");

  // Email Availability Check States
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availability, setAvailability] = useState<{
    checked: boolean;
    available: boolean;
    email?: string;
    message?: string;
  }>({ checked: false, available: false });

  // Submission States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Close domain dropdown when clicking outside
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch available domains on mount
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
      } catch (err: any) {
        if (mounted) {
          setError("Failed to load email domains. Please try again later.");
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

  // Debounced email availability check
  const checkUsernameAvailability = useCallback(
    async (uname: string, dId: string) => {
      const cleanUname = uname.trim();
      if (!cleanUname || !dId) {
        setAvailability({ checked: false, available: false });
        return;
      }

      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(cleanUname)) {
        setAvailability({
          checked: true,
          available: false,
          message: "Only letters, numbers, dots, hyphens, and underscores allowed.",
        });
        return;
      }

      setCheckingAvailability(true);
      try {
        const res = await api.checkAvailability(cleanUname, dId);
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

  // Selected domain object
  const selectedDomain = domains.find((d) => d.id === domainId) || domains[0];

  // Validation rules for current step
  const isStepValid = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        return firstName.trim().length >= 1 && lastName.trim().length >= 1;
      case 2:
        return true; // Date of birth is optional
      case 3:
        return (
          username.trim().length >= 2 &&
          !checkingAvailability &&
          availability.checked &&
          availability.available
        );
      case 4:
        return (
          password.length >= 8 &&
          confirmPassword.length >= 8 &&
          password === confirmPassword
        );
      case 5:
        return true;
      default:
        return false;
    }
  };

  const goToStep = (targetStep: number) => {
    if (targetStep < 1 || targetStep > TOTAL_STEPS) return;
    if (targetStep > step && !isStepValid(step)) return;

    setError("");
    setDirection(targetStep > step ? 1 : -1);
    setStep(targetStep);
  };

  const handleNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isStepValid(step)) {
      if (step === 1 && (!firstName.trim() || !lastName.trim())) {
        setError("Please enter your first and last name.");
      } else if (step === 3 && (!availability.checked || !availability.available)) {
        setError("Please choose an available email address.");
      } else if (step === 4 && password.length < 8) {
        setError("Password must be at least 8 characters long.");
      } else if (step === 4 && password !== confirmPassword) {
        setError("Passwords do not match.");
      }
      return;
    }

    setError("");
    if (step < TOTAL_STEPS) {
      setDirection(1);
      setStep((prev) => prev + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    setError("");
    if (step > 1) {
      setDirection(-1);
      setStep((prev) => prev - 1);
    }
  };

  const handleFinalSubmit = async () => {
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

      // User session cookies set automatically by the backend
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please check your details.");
      setSubmitting(false);
    }
  };

  // Password strength score (0 to 4)
  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const passwordStrength = calculatePasswordStrength(password);
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "bg-destructive",
    "bg-amber-500",
    "bg-blue-500",
    "bg-emerald-500",
  ];

  const currentMeta = STEP_METADATA[step - 1];
  const StepIcon = currentMeta.icon;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-3 sm:p-6 lg:p-8">
      <div className="max-w-xl w-full bg-card border border-border shadow-xl rounded-3xl p-6 sm:p-10 space-y-6 transition-all duration-300">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-foreground tracking-tight block">
                FreeMailo
              </span>
              <span className="text-xs text-muted-foreground block -mt-0.5">
                Privacy-first email service
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Step {step} of {TOTAL_STEPS}
            </span>
            <span className="text-xs font-medium text-primary block">
              {currentMeta.label}
            </span>
          </div>
        </div>

        {/* Top Progress Segmented Track */}
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {STEP_METADATA.map((m) => {
              const isCompleted = m.step < step;
              const isCurrent = m.step === step;
              return (
                <button
                  key={m.step}
                  type="button"
                  onClick={() => isCompleted && goToStep(m.step)}
                  disabled={!isCompleted}
                  className={`group relative h-2 rounded-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-primary cursor-pointer hover:opacity-80"
                      : isCurrent
                      ? "bg-primary/80 ring-2 ring-primary/30"
                      : "bg-muted"
                  }`}
                  title={`${m.label} ${isCompleted ? "(Click to edit)" : ""}`}
                >
                  <span className="sr-only">
                    Step {m.step}: {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-in fade-in"
          >
            <XCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Step Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <StepIcon className="w-3.5 h-3.5" />
            <span>{currentMeta.label}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {currentMeta.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {currentMeta.subtitle}
          </p>
        </div>

        {/* Progressive Step Forms */}
        <form onSubmit={handleNext} className="space-y-5">
          {/* STEP 1: Personal Details (Name) */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-xs font-semibold text-muted-foreground mb-1.5"
                  >
                    First Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    autoFocus
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. David"
                    className="w-full h-11 px-3.5 rounded-2xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-xs font-semibold text-muted-foreground mb-1.5"
                  >
                    Last Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Smith"
                    className="w-full h-11 px-3.5 rounded-2xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="middleName"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Middle Name{" "}
                  <span className="text-muted-foreground/60 font-normal">
                    (Optional)
                  </span>
                </label>
                <input
                  id="middleName"
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="e.g. Robert"
                  className="w-full h-11 px-3.5 rounded-2xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border/50 text-xs text-muted-foreground flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Your name will be visible as your sender display name on outgoing
                  emails.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: Date of Birth */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div>
                <label
                  htmlFor="dateOfBirth"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="dateOfBirth"
                    type="date"
                    autoFocus
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full h-11 pl-10 pr-4 rounded-2xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border/50 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  Why we ask for birthday
                </p>
                <p>
                  FreeMailo uses your birth date for age verification and as an
                  additional identity verification layer if you ever need to restore
                  account access.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Choose Email Address (Unified Single Input Container) */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Your Email Address <span className="text-destructive">*</span>
                </label>

                {/* THE UNIFIED SINGLE INPUT BOX WITH INTEGRATED DOMAIN PICKER */}
                <div
                  ref={domainDropdownRef}
                  className="relative flex items-center h-12 w-full rounded-2xl border border-input bg-background focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary transition-all shadow-sm pl-3.5 pr-2 gap-2"
                >
                  {/* Left Icon */}
                  <AtSign className="w-4 h-4 text-muted-foreground/60 shrink-0" />

                  {/* Username Input Field */}
                  <input
                    id="username"
                    type="text"
                    required
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, ""),
                      )
                    }
                    placeholder="davidsmith"
                    className="bg-transparent border-0 p-0 text-sm sm:text-base font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 flex-1 min-w-0"
                  />

                  {/* Inline Domain Badge & Switcher Button */}
                  <div className="relative shrink-0 flex items-center">
                    <button
                      type="button"
                      onClick={() => setDomainDropdownOpen(!domainDropdownOpen)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground font-medium text-xs sm:text-sm border border-border/70 transition-all select-none"
                      title="Click to change domain"
                    >
                      <span className="font-semibold text-muted-foreground">
                        @{selectedDomain?.name || "example.com"}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          domainDropdownOpen ? "rotate-180 text-primary" : ""
                        }`}
                      />
                    </button>

                    {/* Domain Selection Popover Menu */}
                    {domainDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-64 max-h-60 overflow-y-auto rounded-2xl bg-popover border border-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1">
                          Available Domains
                        </div>
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
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow-sm"
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

                {/* Live Availability Status */}
                <div className="mt-2 min-h-[24px] flex items-center text-xs">
                  {checkingAvailability && (
                    <span className="text-muted-foreground flex items-center gap-1.5 animate-pulse font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      Checking availability...
                    </span>
                  )}

                  {!checkingAvailability && availability.checked && (
                    <>
                      {availability.available ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>
                            <strong>{username}@{selectedDomain?.name}</strong> is available!
                          </span>
                        </span>
                      ) : (
                        <span className="text-destructive font-semibold flex items-center gap-1.5 animate-in fade-in">
                          <XCircle className="w-4 h-4 text-destructive shrink-0" />
                          <span>
                            {availability.message || (
                              <>
                                <strong>{username}@{selectedDomain?.name}</strong> is already taken. Try another name or click the arrow to switch domains.
                              </>
                            )}
                          </span>
                        </span>
                      )}
                    </>
                  )}

                  {!checkingAvailability && !availability.checked && username.trim() === "" && (
                    <span className="text-muted-foreground/80">
                      Type your desired username and use the right arrow to switch domains.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Password & Security */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Create Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full h-11 pl-10 pr-11 rounded-2xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {password && (
                  <div className="mt-2 space-y-1.5 animate-in fade-in">
                    <div className="flex gap-1.5 h-1.5">
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            index < passwordStrength
                              ? strengthColors[passwordStrength - 1] || "bg-primary"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span>
                        Strength:{" "}
                        <strong className="text-foreground">
                          {strengthLabels[passwordStrength - 1] || "Too short"}
                        </strong>
                      </span>
                      <span>Min 8 characters</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Confirm Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full h-11 pl-10 pr-11 rounded-2xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {password && confirmPassword && (
                  <div className="mt-2 text-xs">
                    {password === confirmPassword ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Passwords match
                      </span>
                    ) : (
                      <span className="text-destructive font-semibold flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                        Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Recovery Email & Final Confirmation */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div>
                <label
                  htmlFor="recoveryEmail"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  External Recovery Email{" "}
                  <span className="text-muted-foreground/60 font-normal">
                    (Optional)
                  </span>
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="recoveryEmail"
                    type="email"
                    autoFocus
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="backup@example.com"
                    className="w-full h-11 pl-10 pr-4 rounded-2xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm transition-all"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used exclusively for security notifications and password reset links.
                </p>
              </div>

              {/* Review Summary Card */}
              <div className="rounded-2xl border border-border/80 bg-secondary/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Account Summary
                  </span>
                  <span className="text-[11px] text-primary font-semibold">
                    Ready to create
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Full Name:</span>
                    <span className="font-semibold text-foreground">
                      {firstName} {middleName ? `${middleName} ` : ""}{lastName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">FreeMailo Address:</span>
                    <span className="font-bold text-primary px-2 py-0.5 rounded-lg bg-primary/10">
                      {username}@{selectedDomain?.name}
                    </span>
                  </div>

                  {dateOfBirth && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Birthday:</span>
                      <span className="font-semibold text-foreground">{dateOfBirth}</span>
                    </div>
                  )}

                  {recoveryEmail && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recovery Email:</span>
                      <span className="font-semibold text-foreground">{recoveryEmail}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions & Navigation Controls */}
          <div className="pt-2 flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="h-11 px-4 rounded-2xl border border-border bg-background hover:bg-secondary text-foreground text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}

            <button
              type="submit"
              disabled={submitting || !isStepValid(step)}
              className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 flex items-center justify-center gap-2 shadow-md hover:shadow transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : step < TOTAL_STEPS ? (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Create FreeMailo Account
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Link to Sign In */}
        <div className="pt-2 border-t border-border/60 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
