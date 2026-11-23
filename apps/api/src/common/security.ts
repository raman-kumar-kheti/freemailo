import { NextFunction, Request, Response } from "express";

/**
 * Returns an array of allowed browser origins parsed from process.env.APP_URL
 * Defaults to local development origins if not configured.
 */
export function getAllowedOrigins(): string[] {
  const raw =
    process.env.APP_URL ||
    "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:3001";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Browsers attach Origin to unsafe cross-origin requests. Reject those before
// cookie authentication; require a custom header on cookie-authenticated writes.
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  const allowed = getAllowedOrigins();
  if (origin && !allowed.includes(origin))
    return res.status(403).json({ message: "Origin not allowed" });
  if (
    (req.cookies?.access_token || req.cookies?.refresh_token) &&
    !req.get("authorization") &&
    !["FreeMailo", "MailHive"].includes(req.get("x-requested-with") || "")
  ) {
    return res.status(403).json({ message: "CSRF protection header required" });
  }
  next();
}
