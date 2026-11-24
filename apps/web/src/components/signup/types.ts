import { PublicDomain } from "@/lib/api";

export interface SignupFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  username: string;
  domain: string;
  password: string;
  confirmPassword: string;
  recoveryEmail: string;
}

export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface AvailabilityState {
  checked: boolean;
  available: boolean;
  email?: string;
  message?: string;
}

export interface StepProps {
  data: SignupFormData;
  onChange: (fields: Partial<SignupFormData>) => void;
  errors: Record<string, string | undefined>;
  setFieldError: (field: string, message?: string) => void;
  onNext: () => void;
  direction: number;
}
