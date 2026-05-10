#!/usr/bin/env node
// Sign a short-lived HS256 JWT for the /health-check page using only Node built-ins.
// Used inside the web container's entrypoint so the web service can call the
// AuthBridge-protected API without an external token-issuance step.
//
// Reads:
//   JWT_SECRET           required (>= 16 chars), shared with the api service
//   DEV_JWT_SUB          optional, default "dev-user-1"
//   DEV_JWT_EMAIL        optional, default "dev@example.com"
//   DEV_JWT_TTL_SECONDS  optional, default 86400 (24h)

const crypto = require('node:crypto');

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 16) {
  console.error('sign-dev-jwt: JWT_SECRET is required and must be at least 16 characters');
  process.exit(1);
}

const sub = process.env.DEV_JWT_SUB || 'dev-user-1';
const email = process.env.DEV_JWT_EMAIL || 'dev@example.com';
const ttl = Number.parseInt(process.env.DEV_JWT_TTL_SECONDS || '86400', 10);

const now = Math.floor(Date.now() / 1000);
const header = { alg: 'HS256', typ: 'JWT' };
const payload = { sub, email, iat: now, exp: now + ttl };

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const signing = `${b64(header)}.${b64(payload)}`;
const signature = crypto.createHmac('sha256', secret).update(signing).digest('base64url');

process.stdout.write(`${signing}.${signature}`);
