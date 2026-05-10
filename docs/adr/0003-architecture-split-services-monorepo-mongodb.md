# Architecture: split frontend/backend in a monorepo, MongoDB Atlas

We considered a single Next.js full-stack app (Server Actions + Postgres + Drizzle) versus a split frontend/backend. We chose **a split — Next.js frontend + a dedicated Node backend service — co-located in a monorepo**, with **MongoDB Atlas** as the datastore. NextAuth/Auth.js handles authentication on the frontend.

## Why split

- A separate backend service has a stable API contract that other clients (future native apps, batch jobs, scheduled materialisation workers) can share without adopting Next.js conventions.
- The recurring-expense materialisation worker needs to run on a schedule independent of HTTP traffic — easier as a process inside a backend service than as a Vercel cron hitting a Next.js route.
- Backend logic (aggregation pipelines for the insight engine, scheduled jobs, NextAuth session validation, audit log writes) is centralized in one place rather than scattered across Server Actions.

## Why monorepo

- Shared types between frontend and backend (Expense shape, role enums, justification flag) — single source of truth, no duplication or drift.
- Single PR can change the API and its consumer atomically.
- One install, one lint config, one CI pipeline.

## Why MongoDB

- Chosen by the team. Atlas as the managed offering — no DB ops.
- Document model fits the Expense shape well (variable optional fields: notes, tags, payment method).
- Aggregation pipelines handle the insights/reports requirements (category breakdowns, monthly trends).

## Consequences

- Cross-collection joins (e.g., Expense → User who recorded it) require `$lookup` aggregations; we'll embed user display names where helpful and re-denormalize on user updates rather than join on every read.
- No relational integrity — orphaned references are possible. Application code must enforce that Expense.householdId, Category.householdId, etc. point to existing Households.
- NextAuth runs on the frontend; the backend service must independently verify session credentials. See ADR-0004 for the bridge mechanism.
- We pay the tax of two services in the deploy story: frontend on a Next.js host, backend on a Node host. Acceptable for the architectural clarity.
