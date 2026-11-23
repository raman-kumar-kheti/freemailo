import { getAllowedOrigins } from "./security";

export function validateEnvironment(env: Record<string, unknown>) {
  if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  if (
    typeof env.DOVECOT_MASTER_PASSWORD !== "string" ||
    !env.DOVECOT_MASTER_PASSWORD
  )
    throw new Error("DOVECOT_MASTER_PASSWORD is required");
  if (env.NODE_ENV === "production") {
    if (
      env.COOKIE_SECURE === "false" ||
      env.MAIL_TLS_REJECT_UNAUTHORIZED === "false"
    )
      throw new Error(
        "Production requires secure cookies and verified mail TLS",
      );
    const origins = getAllowedOrigins();
    if (
      origins.length === 0 ||
      !origins.every((url) => /^https:\/\//.test(url))
    )
      throw new Error(
        "ALLOWED_ORIGINS (or APP_URL) must contain explicit HTTPS origins in production",
      );
    if (/change.?me|dev_|example/i.test(env.JWT_SECRET))
      throw new Error("Replace the example JWT secret before production");
  }
  return env;
}
