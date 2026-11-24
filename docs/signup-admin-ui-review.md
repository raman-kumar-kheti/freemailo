# Signup and admin UI review — 24 November 2026

This revision covers presentation and interaction for signup and all admin pages. Backend services, API contracts, authorization, signup validation, provisioning and persistence were not changed. Existing request payloads are checked with browser fixtures.

## Signup

- Preserved the rounded card and teal identity. Fields remain visible while earlier values are edited, instead of repeatedly expanding and collapsing sections.
- Reserved space for availability, password strength and matching feedback. Submission errors appear beside the submit button and preserve entered values.
- Used a native, labelled domain selector, autocomplete hints, accessible password toggles and larger mobile controls. Mobile inputs use 16px text to avoid automatic Safari input zoom.
- Added the mail UI's persistent light/dark theme control.

## Administration

- Updated overview, domains/DNS, mailboxes, aliases, provisioning jobs, audit trail and admin login to the mail UI's semantic colors, rounded surfaces, typography and controls.
- Added a responsive navigation drawer, semantic links, active page indication and a skip link.
- Reused Radix dialogs for forms, DNS details, confirmations and feedback, with keyboard dismissal and focus recovery. Cancelling deletion still makes no request; form errors retain input values.
- Made every wide data table horizontally scrollable and keyboard focusable on small screens. Removed the static header's unsupported “100% healthy” assertion; the overview still displays its existing API-driven service health.

## Motion decisions

Applied the `animate` and `ui-ux-pro-max` skills. Typing, validation and frequent table interactions stay stationary. Rare authentication page entrances use a 200ms opacity transition with `cubic-bezier(0.23, 1, 0.32, 1)`. Reduced-motion preferences disable the entrance. No animation dependency was added.

## Verification

- Frontend typecheck, lint and production build passed.
- **14 Chromium browser tests passed against the production build:** six signup/admin UI flows and eight existing mail UI regression flows.
- Axe reported no WCAG 2.1 A/AA violations in the tested signup, admin pages and modal states. All admin routes were checked in light and dark themes.
- Covered stable signup field positions, visible submission errors, preserved signup/admin request payloads, confirmation cancellation, nested error-dialog focus, keyboard table scrolling, mobile navigation and reduced motion.
- Checked desktop (1440×960), mobile (375×812), landscape (812×375), and narrow (320×640) layouts. Screenshots below were visually inspected.

The browser suite intercepts API requests with test-only fixtures. It verifies UI behavior and request contracts, not live mail delivery or backend deployment.

```sh
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
API_URL=http://127.0.0.1:4000 npm --prefix apps/web run build

# In apps/web, start the built frontend in one terminal:
API_URL=http://127.0.0.1:4000 npx next start -p 3002 --hostname 127.0.0.1

# Then, also from apps/web:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npx playwright test e2e/signup-admin-ui.spec.ts e2e/redesign.spec.ts --workers=1
```

## Screenshots

[Signup](ui-review/signup-mobile.png) · [Signup dark theme](ui-review/signup-dark.png) · [Admin overview](ui-review/admin-overview.png) · [Domains dark theme](ui-review/admin-domains-dark.png) · [Mobile admin](ui-review/admin-mobile.png) · [Mailbox dialog](ui-review/admin-mailbox-dialog.png)
