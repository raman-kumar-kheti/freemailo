export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateFirstName(firstName: string): ValidationResult {
  const trimmed = firstName.trim();
  if (!trimmed) {
    return { isValid: false, error: "Enter first name" };
  }
  return { isValid: true };
}

export function validateLastName(lastName: string): ValidationResult {
  const trimmed = lastName.trim();
  if (!trimmed) {
    return { isValid: false, error: "Enter last name" };
  }
  return { isValid: true };
}

export function validateDateOfBirth(dob: string): ValidationResult {
  if (!dob || !dob.trim()) {
    // Optional field
    return { isValid: true };
  }

  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) {
    return { isValid: false, error: "Please enter a valid date" };
  }

  const today = new Date();
  // Strip time for clean comparison
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedDate = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());

  if (selectedDate > todayDate) {
    return { isValid: false, error: "Date of birth must be in the past" };
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 13) {
    return { isValid: false, error: "You must be at least 13 years old to create an account" };
  }

  if (age > 125 || birthDate.getFullYear() < 1900) {
    return { isValid: false, error: "Please enter a valid date of birth" };
  }

  return { isValid: true };
}

export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim();
  if (!trimmed) {
    return { isValid: false, error: "Choose a username" };
  }

  if (trimmed.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters" };
  }

  if (trimmed.length > 30) {
    return { isValid: false, error: "Username cannot exceed 30 characters" };
  }

  if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
    return { isValid: false, error: "Username cannot start or end with a period" };
  }

  if (trimmed.includes("..")) {
    return { isValid: false, error: "Username cannot contain consecutive periods" };
  }

  const allowedRegex = /^[a-zA-Z0-9._-]+$/;
  if (!allowedRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Only letters, numbers, periods, hyphens, and underscores are allowed",
    };
  }

  return { isValid: true };
}

export function calculatePasswordStrength(pass: string): number {
  let score = 0;
  if (!pass) return score;
  if (pass.length >= 8) score++;
  if (pass.length >= 12) score++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;
  return score;
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: "Enter a password" };
  }
  if (password.length < 8) {
    return { isValid: false, error: "Use 8 characters or more for your password" };
  }
  return { isValid: true };
}

export function validateConfirmPassword(password: string, confirmPassword: string): ValidationResult {
  if (!confirmPassword) {
    return { isValid: false, error: "Confirm your password" };
  }
  if (password !== confirmPassword) {
    return { isValid: false, error: "Those passwords didn’t match. Try again." };
  }
  return { isValid: true };
}

export function validateRecoveryEmail(recoveryEmail: string, newEmailAddress?: string): ValidationResult {
  const trimmed = recoveryEmail.trim();
  if (!trimmed) {
    // Optional field
    return { isValid: true };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: "Enter a valid email address" };
  }

  if (newEmailAddress && trimmed.toLowerCase() === newEmailAddress.toLowerCase()) {
    return {
      isValid: false,
      error: "Recovery email cannot be the same as your new FreeMailo address",
    };
  }

  return { isValid: true };
}
