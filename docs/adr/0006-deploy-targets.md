# Deploy targets: Vercel + Fly.io + Atlas M0, all on free tiers

The MVP deploys to free tiers across the board. **Frontend on Vercel Hobby**, **backend on Fly.io** in `ap-south-1` (Mumbai), **MongoDB Atlas M0** also in `ap-south-1`. Monorepo tooling is **pnpm workspaces** alone — no Turborepo until build times demand it.

## Why this combination

- **Free indefinitely** at MVP scale. Each piece has a no-credit-card or low-credit-card free tier that handles a handful of Households.
- **`ap-south-1` co-location** matches India-first defaults (INR + IST). Atlas + Fly in the same region keeps the Mongo round-trip on the order of single-digit milliseconds.
- **Fly.io chosen over Render** specifically because Render's free tier sleeps after 15 minutes of HTTP inactivity, which would silently break the recurring-expense materialiser cron that ticks every 5 minutes (see ADR-0005). Fly's free tier supports always-on instances.
- **Vercel** is the path of least resistance for Next.js — git-push-to-deploy, automatic preview environments, no infra to wrangle.

## Consequences

- Atlas M0 caps at 512MB storage and shared CPU. Real growth requires upgrading to M10+. Acceptable v1 ceiling.
- Fly free tier is one shared-CPU-1x VM with 256MB RAM. Cold-start risk is low (always-on), but vertical limits are real. Scale to a paid plan when traffic justifies.
- Vercel Hobby has bandwidth limits and is non-commercial — if the product gains commercial users, upgrade to Pro.
- Two deploy pipelines (Vercel and Fly) means two sets of env vars, secrets, and build logs to maintain. Acceptable.
- The CI runner is GitHub Actions; Vercel and Fly both integrate via their CLI/Action.
