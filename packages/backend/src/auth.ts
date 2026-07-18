import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import type { D1Database } from '@cloudflare/workers-types';
import type { AuthPayload, Bindings, Variables } from './env';

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

export function getJwtSecret(c: { env: Bindings }) {
  if (!c.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return c.env.JWT_SECRET;
}

export async function readAuth(c: AppContext): Promise<AuthPayload | null> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return await verify(header.slice(7), getJwtSecret(c), 'HS256') as AuthPayload;
  } catch {
    return null;
  }
}

export async function requireAdmin(c: AppContext, next: Next) {
  if (c.req.path.endsWith('/admin/login')) return next();
  const auth = await readAuth(c);
  if (!auth || auth.role !== 'admin') {
    return c.json({ success: false, error: { message: '管理者認証が必要です', code: 'UNAUTHORIZED' } }, 401);
  }
  c.set('auth', auth);
  return next();
}

export async function requireSession(c: AppContext, next: Next) {
  const auth = await readAuth(c);
  if (!auth) {
    return c.json({ success: false, error: { message: 'ログインが必要です', code: 'UNAUTHORIZED' } }, 401);
  }
  c.set('auth', auth);
  return next();
}

const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_FAILURES = 5;

export function loginAttemptKey(c: AppContext, role: 'student' | 'admin', id: string) {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  return `${role}:${ip}:${id.trim().toLowerCase()}`;
}

export async function isLoginLimited(db: D1Database, key: string) {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM login_attempts
    WHERE identity_key=? AND attempted_at >= datetime('now', ?)`)
    .bind(key, `-${LOGIN_WINDOW_MINUTES} minutes`).first<{ count: number }>();
  return (row?.count || 0) >= LOGIN_MAX_FAILURES;
}

export async function recordLoginFailure(db: D1Database, key: string) {
  await db.batch([
    db.prepare('INSERT INTO login_attempts (identity_key) VALUES (?)').bind(key),
    db.prepare("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-1 day')"),
  ]);
}

export async function clearLoginFailures(db: D1Database, key: string) {
  await db.prepare('DELETE FROM login_attempts WHERE identity_key=?').bind(key).run();
}
