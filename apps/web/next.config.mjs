import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@expense/shared'],
  // Emit a self-contained server bundle so the Docker image only needs the standalone tree.
  output: 'standalone',
  // Tell Next.js where the monorepo root is so traced files include workspace deps.
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
