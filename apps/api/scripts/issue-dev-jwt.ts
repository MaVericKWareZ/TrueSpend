/* eslint-disable no-console */
import 'dotenv/config';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    sub: { type: 'string', default: 'dev-user-1' },
    email: { type: 'string', default: 'dev@example.com' },
    ttl: { type: 'string', default: '24h' },
    secret: { type: 'string' },
  },
  strict: true,
});

const secret = values.secret ?? process.env.JWT_SECRET;
if (!secret || secret.length < 16) {
  console.error('JWT_SECRET (env or --secret) is required and must be at least 16 characters.');
  process.exit(1);
}

const expiresIn = values.ttl as SignOptions['expiresIn'];
const token = jwt.sign(
  { sub: values.sub, email: values.email },
  secret,
  { algorithm: 'HS256', expiresIn },
);

console.log(token);
