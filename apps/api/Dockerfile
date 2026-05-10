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
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @expense/api...

# ---- build ----
FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @expense/shared build && pnpm --filter @expense/api build
RUN pnpm deploy --filter @expense/api --prod /app/out

# ---- runner ----
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /app/out/dist ./dist
COPY --from=build --chown=node:node /app/out/node_modules ./node_modules
COPY --from=build --chown=node:node /app/out/package.json ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
