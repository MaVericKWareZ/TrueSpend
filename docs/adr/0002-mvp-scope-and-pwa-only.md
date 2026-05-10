# MVP scope: PWA-only, lean feature set

The PRS Section 12 listed nine MVP features across three platforms (web + iOS + Android). For a small team, that's a 6–9 month surface before first release. We trimmed aggressively and committed to **PWA-only for v1**: a single responsive Next.js-style web app installable on mobile, with no native iOS or Android builds.

## What's in v1

- Auth (email + Google), Household creation + invite link, Owner/Member roles only
- Expense entry (Quick Add), default + custom Categories, free-text Tags
- Recurring expenses (auto-materialised, fixed frequencies — no custom intervals)
- Justified / Unjustified / Neutral flag with Category-level defaults
- Dashboard: monthly spend, category breakdown, justified-spending percentage
- Search by merchant; filter by date / category / tag
- CSV export
- In-app reminder banner for upcoming recurring expenses
- Audit fields (`updated_by`, change log table) stored but not surfaced in UI

## What's deferred

- iOS / Android native apps (PWA covers mobile)
- Apple Sign-In, Viewer role, voice input, custom-interval recurring
- Receipt attachments, OCR
- Heatmaps, budget bars, narrative insight engine ("Dining up 32%")
- Filter by member / payment method / justification
- CSV import
- Push and email notifications
- Audit log browsing UI (data is captured, just no UI)

## Why PWA-only

- No app store overhead (review cycles, two release pipelines, native build infra).
- Single codebase, single deployment, single testing surface.
- Installable via "Add to Home Screen" on Android and (with limitations) iOS.
- Push notifications, the most-cited reason to go native, are explicitly deferred.

## Consequences

- The PWA must hit the spec's perf targets (launch < 2s, save < 1s) on mid-tier mobile networks. This is the binding constraint, not desktop performance.
- iOS PWA install UX is rougher than Android — accept and document. Add-to-home-screen onboarding hint for Safari users.
- "Multi-device sync" (9.1) is satisfied by a server-of-record model — sessions sync via login, not via a sync engine.
- If we ever need real native features (deep biometrics, background sync, rich notifications), this becomes a rewrite to Capacitor / RN / Flutter. Acceptable v2 risk.
