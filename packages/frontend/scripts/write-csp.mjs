import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configuredApi = process.env.VITE_API_URL?.trim();
if (process.env.CSP_REQUIRE_API_URL === 'true' && !configuredApi) {
  throw new Error('VITE_API_URL is required for a production CSP build');
}
let connectSource = "'self'";

if (configuredApi) {
  const apiUrl = new URL(configuredApi);
  if (apiUrl.protocol !== 'https:') throw new Error('Production VITE_API_URL must use HTTPS for CSP');
  connectSource += ` ${apiUrl.origin}`;
} else {
  connectSource += ' http://localhost:* http://127.0.0.1:*';
}

const policy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src ${connectSource}`,
  "img-src 'self' data:",
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const headers = `/*
  Content-Security-Policy: ${policy}
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`;

mkdirSync(path.join(frontendDir, 'dist'), { recursive: true });
writeFileSync(path.join(frontendDir, 'dist', '_headers'), headers, 'utf8');
process.stdout.write(`CSP generated for connect-src ${connectSource}\n`);
