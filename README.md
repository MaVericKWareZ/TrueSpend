# Expense Tracker

An India-first collaborative household expense management product. Web-only PWA in v1.

This repository is in **foundation + email auth** state — the monorepo skeleton, JWT auth bridge, audit log infrastructure, **and** email/password authentication (signup, sign-in, forgot-password, reset-password) are in place. Product features (households, expenses, recurring) land in subsequent issues.

## Architecture at a glance

- **Monorepo** with pnpm workspaces.
- **Frontend**: Next.js (App Router) at `apps/web` — deploys to Vercel.
- **Backend**: NestJS at `apps/api` — deploys to Fly.io (`ap-south-1`).
- **Database**: MongoDB Atlas (M0, `ap-south-1`) via Mongoose.
- **Shared types**: `packages/shared` — TypeScript types consumed by both apps.

See [`CONTEXT.md`](./CONTEXT.md) for the domain glossary and [`docs/adr/`](./docs/adr/) for the architectural decisions.

## Prerequisites

- **Node ≥ 20** (`.nvmrc` pins this).
- **pnpm ≥ 9** via Corepack (`corepack enable`).
- A local **MongoDB** (`docker run -p 27017:27017 mongo:7` or `brew services start mongodb-community`) **OR** an Atlas SRV URI for development.

## Run with Docker Compose (single command)

Mongo is expected to already be running on your host (port 27017). Then:

```bash
docker compose up --build
# or:  pnpm start
```

That's it. Open <http://localhost:3000/health-check> — it should render `Status: OK`.

The compose stack uses a dev-only default `JWT_SECRET` so the command works with zero setup. The web container mints its own dev JWT from that secret at boot.

For a per-machine secret, drop one in `.env`:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up --build
```

Stop with `docker compose down` (or `pnpm stop`). If your Mongo is on a non-default host/port, set `MONGODB_URI` in `.env` (e.g. `mongodb://192.168.1.10:27017/expense-tracker`).

⚠️ The dev default `JWT_SECRET` baked into `docker-compose.yml` is for local development only. Production deploys (Fly.io, Vercel) use real secrets injected via `flyctl secrets set` and the Vercel dashboard.

---

## Local development

```bash
# 1. Install
corepack enable
pnpm install

# 2. Configure env
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET (32+ chars).

# 3. Start a local Mongo (or use Atlas)
docker run -d --name expense-mongo -p 27017:27017 mongo:7

# 4. Run the backend
pnpm dev:api
# -> API listening on http://localhost:3001

# 5. Issue a dev test JWT and copy it
JWT=$(JWT_SECRET="$(grep ^JWT_SECRET .env | cut -d= -f2-)" pnpm --silent issue-dev-jwt)
echo "$JWT"

# 6. Set the dev JWT for the web app
echo "API_BASE_URL=http://localhost:3001" >> apps/web/.env.local
echo "DEV_JWT=$JWT" >> apps/web/.env.local

# 7. Run the frontend
pnpm dev:web
# -> http://localhost:3000

# 8. Open http://localhost:3000/health-check — should render { "status": "ok" }.
```

## Email auth (NextAuth + AuthBridge)

Issue 02 wires NextAuth's Credentials provider on the frontend and four `/auth/*` endpoints on the backend. **Two distinct tokens** flow through the system:

- `NEXTAUTH_SECRET` encrypts NextAuth's JWE session cookie (used for Next.js-side gates: server components, middleware).
- `JWT_SECRET` signs an HS256 JWS `accessToken` minted in NextAuth's `jwt` callback. The browser forwards it to the backend as `Authorization: Bearer …`; `AuthBridge` verifies the signature with the same `JWT_SECRET` (per [ADR-0004](./docs/adr/0004-auth-jwt-bridge-frontend-to-backend.md)).

The two values are **not interchangeable**. `JWT_SECRET` must match between `apps/api/.env.local` and `apps/web/.env.local`.

### Auth pages

- `/signup` — email + name + password. 409 on duplicate.
- `/sign-in` — generic "Invalid email or password" error (no enumeration leak).
- `/forgot-password` — emails a reset link via the configured `Mailer` (defaults to `ConsoleMailer`, which logs to the API console). 404 with a sign-up link if the email is unknown.
- `/reset-password?token=…` — single-use, 1-hour TTL.

### Reading the dev mailer output

With `MAILER_DRIVER=console` (the default), `apps/api` logs forgot-password emails to its own stdout under the `[ConsoleMailer]` prefix:

```
[Mailer] to=alice@example.com subject="Reset your Expense Tracker password"
Hi Alice,

Click the link below to reset your password:
http://localhost:3000/reset-password?token=ab12...
```

Tail the API logs while developing to grab the link.

### Local smoke test (5 min)

```bash
pnpm dev:api  # terminal 1
pnpm dev:web  # terminal 2
# 1. Visit http://localhost:3000/signup → create alice@example.com / "correcthorsebatterystaple"
# 2. Lands on / signed in. Click sign out.
# 3. Visit /sign-in, sign back in.
# 4. Sign out, /forgot-password with alice@example.com.
# 5. In the api terminal, copy the http://localhost:3000/reset-password?token=… URL and open it.
# 6. Set a new password — auto-redirects to /sign-in?reset=ok.
```

## Issuing a dev test JWT

The backend's `AuthBridge` middleware (per [ADR-0004](./docs/adr/0004-auth-jwt-bridge-frontend-to-backend.md)) requires every request to carry a valid HS256 JWT signed with `JWT_SECRET`. A small CLI script signs dev tokens for local use:

```bash
# Defaults: sub=dev-user-1, email=dev@example.com, ttl=24h
pnpm issue-dev-jwt

# With explicit values
pnpm issue-dev-jwt --sub user-42 --email alice@example.com --ttl 7d
```

The script reads `JWT_SECRET` from `.env`. **Production tokens come from NextAuth post-issue 02 — never use these dev tokens in production.**

## Project layout

```
expense-tracker/
├── apps/
│   ├── api/              # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/     # AuthBridge middleware (JWT verify) + AuthModule
│   │   │   ├── audit/    # AuditLogger service + Mongoose schema
│   │   │   ├── config/   # Env validation (zod)
│   │   │   └── health/   # /health endpoint behind AuthBridge
│   │   ├── scripts/      # issue-dev-jwt CLI
│   │   ├── test/         # Test helpers (mongo-memory, signTestToken)
│   │   ├── Dockerfile
│   │   └── fly.toml
│   └── web/              # Next.js (App Router) frontend
│       └── src/app/
│           ├── page.tsx
│           └── health-check/page.tsx   # signed call to API /health
├── packages/
│   └── shared/           # TypeScript types (AuthContext, HealthResponse)
├── docs/
│   ├── adr/              # ADR-0001 .. ADR-0006
│   └── agents/           # Agent skill configuration
└── .scratch/
    └── expense-tracker-mvp/
        ├── PRD.md
        └── issues/       # 19 implementation issues
```

## Scripts

```bash
pnpm build           # Build all workspaces (shared first, then apps)
pnpm test            # Vitest across all workspaces
pnpm lint            # tsc --noEmit / next lint per workspace
pnpm format          # Prettier write
pnpm dev:api         # NestJS in watch mode
pnpm dev:web         # Next.js dev server
pnpm issue-dev-jwt   # Issue a dev HS256 JWT
```

## Environment variables

| Name                       | Scope | Required   | Example                                       | Description                                                                                       |
| -------------------------- | ----- | ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`              | api   | yes        | `mongodb://localhost:27017/expense-tracker`   | Mongo SRV/connection string. Validated at boot.                                                   |
| `JWT_SECRET`               | api+web | yes      | (32+ char random string)                      | HS256 secret. Both `AuthBridge` (api) and the NextAuth `signAccessToken` helper (web) use it.    |
| `PORT`                     | api   | no         | `3001`                                        | API listen port. Defaults to 3001.                                                                |
| `NODE_ENV`                 | api   | no         | `development`                                 | One of `development`, `test`, `production`.                                                       |
| `MAILER_DRIVER`            | api   | no         | `console`                                     | Mailer adapter. Only `console` is supported pre-ESP.                                              |
| `RESET_TOKEN_TTL_MINUTES`  | api   | no         | `60`                                          | Password-reset token lifetime in minutes.                                                         |
| `THROTTLE_DISABLED`        | api   | no (test)  | `false`                                       | Set `true` in tests to bypass rate limiting.                                                      |
| `PUBLIC_APP_URL`           | api   | no         | `http://localhost:3000`                       | Frontend URL used in reset-password emails.                                                       |
| `NEXTAUTH_URL`             | web   | yes        | `http://localhost:3000`                       | URL the app is reachable at.                                                                      |
| `NEXTAUTH_SECRET`          | web   | yes        | (output of `openssl rand -base64 32`)         | Encrypts NextAuth's JWE session cookie. **Distinct from `JWT_SECRET`.**                          |
| `NEXT_PUBLIC_API_URL`      | web   | yes        | `http://localhost:3001`                       | Browser-reachable backend URL. Used by `fetchApi`.                                                |
| `API_BASE_URL`             | web   | no         | `http://localhost:3001`                       | **Server-only** override. Used by NextAuth's `authorize()` callback and the legacy `/health-check` page. |
| `DEV_JWT`                  | web   | yes (dev)  | (output of `pnpm issue-dev-jwt`)              | **Server-only.** Long-lived JWT used by the `/health-check` page only.                            |

⚠️ `NEXTAUTH_SECRET` and `JWT_SECRET` serve different purposes — generate two distinct values. `API_BASE_URL` and `DEV_JWT` are **server-only**; the JWT never reaches the browser.

## Deploy

### Backend → Fly.io (`ap-south-1`)

One-time setup:

```bash
# Install flyctl, then
flyctl auth login
flyctl launch --no-deploy --config apps/api/fly.toml --copy-config
flyctl secrets set MONGODB_URI="mongodb+srv://..." JWT_SECRET="$(openssl rand -hex 32)"
```

Thereafter, every push to `main` that changes `apps/api/**` or `packages/shared/**` triggers `.github/workflows/deploy-api.yml`, which runs `flyctl deploy` with the `FLY_API_TOKEN` repo secret.

### Frontend → Vercel Hobby

Configure in the Vercel dashboard:

- **Root directory**: `apps/web`
- **Framework preset**: Next.js
- **Install command**: `pnpm install --frozen-lockfile`
- **Env vars**: `API_BASE_URL` (Fly app URL), `DEV_JWT` (a long-lived dev token; replace with NextAuth-issued tokens once issue 02 lands)
- Connect to the `main` branch — pushes auto-deploy.

### Database → MongoDB Atlas M0

- Create an M0 cluster in `ap-south-1` (Mumbai).
- Allowlist Fly's outbound IPs (or `0.0.0.0/0` for MVP — known risk, document in your security plan).
- Copy the SRV URI into Fly secrets and Vercel env vars.

## Testing

```bash
pnpm -r test                          # all workspaces
pnpm --filter @expense/api test       # backend (104 tests after issue 02)
pnpm --filter @expense/web test       # frontend (17 tests after issue 02)
pnpm --filter @expense/shared test    # shared schemas (22 tests)
```

The backend uses [`mongodb-memory-server`](https://github.com/typegoose/mongodb-memory-server) for integration tests — no real Mongo needed. Each spec gets an isolated DB via `startInMemoryMongo('<spec-name>')` to avoid file-parallel collisions. NestJS DI is exercised via `Test.createTestingModule(...)` + `supertest`, with the `Mailer` port overridden to a Vitest spy.

## Architectural decisions

- [ADR-0001 — Encryption at rest, not E2E](./docs/adr/0001-encryption-at-rest-not-end-to-end.md)
- [ADR-0002 — MVP scope: PWA-only, lean feature set](./docs/adr/0002-mvp-scope-and-pwa-only.md)
- [ADR-0003 — Split frontend/backend in a monorepo, MongoDB](./docs/adr/0003-architecture-split-services-monorepo-mongodb.md)
- [ADR-0004 — NextAuth JWT verified by backend](./docs/adr/0004-auth-jwt-bridge-frontend-to-backend.md)
- [ADR-0005 — Recurring materialisation: state-based catch-up](./docs/adr/0005-recurring-materialisation-state-based-catchup.md)
- [ADR-0006 — Deploy targets: Vercel + Fly + Atlas, free tiers](./docs/adr/0006-deploy-targets.md)
- [ADR-0007 — Password hashing: argon2id with OWASP-2024 parameters](./docs/adr/0007-password-hashing-argon2id.md)
- [ADR-0008 — Frontend UI stack: Tailwind + shadcn/ui](./docs/adr/0008-frontend-ui-stack-tailwind-shadcn.md)

## Roadmap

See [`.scratch/expense-tracker-mvp/issues/`](./.scratch/expense-tracker-mvp/issues/) for the 19-issue MVP plan. Issue 01 (this slice) is the foundation; issues 02–19 add product features.
