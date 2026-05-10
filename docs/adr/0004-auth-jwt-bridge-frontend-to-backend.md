# Auth bridge: NextAuth JWT verified by backend

NextAuth/Auth.js lives on the Next.js frontend; the NestJS backend needs to authenticate requests without coupling to NextAuth internals. We chose **NextAuth `jwt` session strategy with a shared HS256 secret**: the frontend forwards the JWT on backend calls; the backend verifies the signature and reads `userId` and `email` from the claims. Stateless — no DB hop on the auth path.

## Claims

Minimal at start: `{ sub: userId, email }`. **Household memberships are NOT in the JWT** — the backend looks them up per request (cached in-process or in Redis for short windows). Rationale: stale memberships in a JWT after a member is added/removed are a real correctness hazard; lookup cost is small.

## Consequences

- JWT lifetime is short (~15 min) with NextAuth refresh handling rotation.
- A second consumer (future native app) can use the same JWT flow without backend changes.
- Secret rotation invalidates all in-flight JWTs — document a runbook before launch.
- Logout is best-effort (JWTs remain valid until expiry); for emergency revocation, rotate the secret.

## Implementation note (from issue 02 triage)

NextAuth's default session cookie is **JWE-encrypted**, which `jsonwebtoken.verify()` on the backend cannot read. Rather than fight that default, NextAuth's `jwt` callback signs a **separate** HS256 JWS `accessToken` (via the `jsonwebtoken` package, with the same `JWT_SECRET` the backend `AuthBridge` already verifies) carrying `{ sub, email }` and a 15-min `exp`. The session callback exposes it as `session.accessToken`; the frontend's backend-fetcher attaches it as `Authorization: Bearer …`.

This keeps two tokens in the system with distinct jobs:
- **NextAuth session cookie (JWE):** authenticates the user inside Next.js (server components, middleware, App Router auth gates).
- **`accessToken` (HS256 JWS):** authenticates calls to the NestJS backend.

The pattern mirrors NextAuth's idiomatic handling of OAuth providers' access tokens, which keeps the codebase legible for future maintainers. `AuthBridge` requires no changes from issue 01 — the contract (HS256 bearer JWT, claim trust) is unchanged.
