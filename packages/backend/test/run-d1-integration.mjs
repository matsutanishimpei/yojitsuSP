import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = path.resolve(backendDir, '../../node_modules/wrangler/bin/wrangler.js');

function run(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: backendDir,
    encoding: 'utf8',
    env: { ...process.env, XDG_CONFIG_HOME: path.resolve(backendDir, '../../tmp/wrangler-test-config') },
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) throw new Error(result.error?.message || output);
  return output;
}

run(['d1', 'migrations', 'apply', 'yojitsu-sp-db', '--local']);
run(['d1', 'execute', 'yojitsu-sp-db', '--local', '--file', 'test/d1-integration.sql']);
const result = run([
  'd1', 'execute', 'yojitsu-sp-db', '--local', '--command',
  `SELECT CASE
    WHEN a.memo='appメモ2' AND COALESCE(o.memo, a.memo)='SPメモ'
      AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='sp_teacher_credentials')
      AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='teacher_account_events')
      AND EXISTS (SELECT 1 FROM teachers WHERE id='SP_TEACHER_TEST' AND source_managed=0
        AND is_active=1 AND source_deleted_at IS NULL)
    THEN 'D1_INTEGRATION_OK' ELSE 'D1_INTEGRATION_FAILED' END AS result
   FROM applications a LEFT JOIN application_overrides o ON o.application_id=a.id WHERE a.id=900001`,
]);

if (!result.includes('D1_INTEGRATION_OK')) throw new Error(result);
process.stdout.write('D1 integration test passed\n');
