#!/bin/sh
# Mint a dev JWT from the shared JWT_SECRET and export it for the Next.js process.
# Allows the /health-check Server Component to call the AuthBridge-protected API.
set -e

DEV_JWT="$(node /app/apps/web/scripts/sign-dev-jwt.cjs)"
export DEV_JWT
exec "$@"
