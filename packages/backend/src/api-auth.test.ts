import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { app } from './index';

const env = {
  JWT_SECRET: 'test-secret-that-is-not-used-in-production',
  ALLOWED_ORIGIN: 'https://sp.example.test',
} as any;

const studentToken = (studentId: string, secret = env.JWT_SECRET) => sign({
  sub: studentId,
  role: 'student',
  exp: Math.floor(Date.now() / 1000) + 60,
}, secret, 'HS256');

class LoginAttemptDb {
  attempts = 0;

  prepare(sql: string) {
    const db = this;
    return {
      bind() { return this; },
      async first() {
        if (sql.includes('COUNT(*) AS count')) return { count: db.attempts };
        if (sql.includes('FROM teachers')) return null;
        return null;
      },
      async run() {
        if (sql.includes('INSERT INTO login_attempts')) db.attempts += 1;
        return { meta: { changes: 1 } };
      },
    };
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

describe('API authorization', () => {
  it('rejects unauthenticated card reads', async () => {
    const response = await app.request('/api/cards?student_id=00ZZ0000', {}, env);
    expect(response.status).toBe(401);
  });

  it('prevents a student from reading another student', async () => {
    const token = await studentToken('00ZZ0000');
    const response = await app.request('/api/cards?student_id=00ZZ0001', {
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(response.status).toBe(403);
  });

  it('rejects a token signed with another secret', async () => {
    const token = await studentToken('00ZZ0000', 'wrong-secret');
    const response = await app.request('/api/cards?student_id=00ZZ0000', {
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(response.status).toBe(401);
  });

  it('protects admin APIs independently from the legacy admin_id query', async () => {
    const response = await app.request('/api/admin/students?admin_id=admin', {}, env);
    expect(response.status).toBe(401);
  });

  it('rate limits repeated admin login failures', async () => {
    const db = new LoginAttemptDb();
    const loginEnv = { ...env, DB: db } as any;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.request('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10' },
        body: JSON.stringify({ id: 'unknown', password: 'wrong' }),
      }, loginEnv);
      expect(response.status).toBe(401);
    }
    const limited = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10' },
      body: JSON.stringify({ id: 'unknown', password: 'wrong' }),
    }, loginEnv);
    expect(limited.status).toBe(429);
  });
});
