import { NextFunction, Request, Response } from "express";

// Browsers attach Origin to unsafe cross-origin requests. Reject those before
// cookie authentication; require a custom header on cookie-authenticated writes.
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  const allowed = (process.env.APP_URL || "http://localhost:3000").split(",");
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
