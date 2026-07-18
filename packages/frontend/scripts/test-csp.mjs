import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(frontendDir, 'scripts/write-csp.mjs');
const result = spawnSync(process.execPath, [generator], {
  cwd: frontendDir,
  encoding: 'utf8',
  env: { ...process.env, VITE_API_URL: 'https://api.example.test/path', CSP_REQUIRE_API_URL: 'true' },
});
if (result.status !== 0) throw new Error(result.stderr || result.stdout);

const headers = readFileSync(path.join(frontendDir, 'dist/_headers'), 'utf8');
if (!headers.includes("script-src 'self'")) throw new Error('script-src is not restricted');
if (!headers.includes("connect-src 'self' https://api.example.test")) throw new Error('API origin is missing');
if (headers.includes('/path')) throw new Error('CSP must contain an origin, not an API path');
if (!headers.includes("frame-ancestors 'none'")) throw new Error('framing is not blocked');

const missingApi = spawnSync(process.execPath, [generator], {
  cwd: frontendDir,
  encoding: 'utf8',
  env: { ...process.env, VITE_API_URL: '', CSP_REQUIRE_API_URL: 'true' },
});
if (missingApi.status === 0) throw new Error('production CSP build accepted a missing API URL');
process.stdout.write('CSP generation test passed\n');
