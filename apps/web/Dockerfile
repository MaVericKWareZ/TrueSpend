# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=9.15.0

# ---- base ----
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @expense/web...

# ---- build ----
FROM base AS build
# `NEXT_PUBLIC_*` vars are inlined into the client bundle at `next build` time —
# they MUST be available in this stage, not just at runtime. Pass via build-args.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @expense/shared build && pnpm --filter @expense/web build

# ---- runner ----
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Next.js standalone output places everything under .next/standalone with a
# workspace-shaped tree (because outputFileTracingRoot is the monorepo root).
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /app/apps/web/scripts ./apps/web/scripts

RUN chmod +x ./apps/web/scripts/entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["/app/apps/web/scripts/entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
