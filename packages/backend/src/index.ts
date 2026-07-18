import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sign } from 'hono/jwt';
import { deriveApplicationState } from './application-state';
import type { D1Database, ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
import type { Bindings, Variables } from './env';
import { clearLoginFailures, getJwtSecret, isLoginLimited, loginAttemptKey, recordLoginFailure, requireAdmin, requireSession } from './auth';
import { createStrongCredential, verifyLegacyPassword, verifyStrongCredential } from './password';
import { SyncInProgressError, syncSourceToSp } from './sync';
import { searchCompanies } from './company-search';
import {
  loginSchema,
  adminLoginSchema,
  createTeacherSchema,
  updateTeacherAccessSchema,
  createCardSchema,
  updateCardSchema,
  updateStudentSchema,
  bulkImportSchema,
  saveTemplatesSchema,
  sendEmailSchema,
} from '@my-app/shared';
import type { AdminStudentSummary, ApplicationCard, CompanyMatrixItem, TeacherAccount } from '@my-app/shared';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath('/api');

app.use('*', cors({
  origin: (origin, c) => {
    const allowed = c.env.ALLOWED_ORIGIN;
    if (allowed) return origin === allowed ? origin : '';
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: false,
}));

app.use('/admin/*', requireAdmin);
app.use('/cards', requireSession);
app.use('/cards/*', requireSession);
app.use('/search', requireSession);

// Unified Error Handler
app.onError((err, c) => {
  console.error(err);
  return c.json(
    {
      success: false,
      error: {
        message: err.message || '予期せぬエラーが発生しました',
        code: 'INTERNAL_SERVER_ERROR',
      },
    },
    500
  );
});

// Admin Authorization Helper
const isAuthorizedAdmin = (adminId: string | undefined, expectedAdminId: string) => {
  // Admin routes are protected by JWT middleware. Keep the query parameter only
  // for backwards-compatible Hono RPC signatures during the SP migration.
  return Boolean(adminId && expectedAdminId);
};

const routes = app
  .get('/hello', (c) => {
    return c.json({ message: 'Hello Hono!' });
  })

  .post('/admin/sync', zValidator('query', z.object({ admin_id: z.string() })), async (c) => {
    try {
      const result = await syncSourceToSp(c.env);
      return c.json({ success: true, ...result });
    } catch (error) {
      if (error instanceof SyncInProgressError) {
        return c.json({ success: false, error: { message: error.message } }, 409);
      }
      throw error;
    }
  })

  .get('/admin/sync/status', zValidator('query', z.object({ admin_id: z.string() })), async (c) => {
    const latest = await c.env.DB.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 20').all();
    return c.json({ runs: latest.results });
  })

  .post('/admin/login', zValidator('json', adminLoginSchema), async (c) => {
    const { id, password } = c.req.valid('json');
    const attemptKey = loginAttemptKey(c, 'admin', id);
    if (await isLoginLimited(c.env.DB, attemptKey)) {
      return c.json({ success: false, error: { message: 'ログイン試行回数が上限に達しました。15分後に再度お試しください' } }, 429);
    }
    const teacher = await c.env.DB.prepare(
      'SELECT id, name, password FROM teachers WHERE id = ? AND is_active = 1 AND source_deleted_at IS NULL'
    ).bind(id.trim()).first<{ id: string; name: string; password: string }>();
    if (!teacher) {
      await recordLoginFailure(c.env.DB, attemptKey);
      return c.json({ success: false, error: { message: '教員IDまたはパスワードが正しくありません' } }, 401);
    }

    const strong = await c.env.DB.prepare(
      'SELECT salt, iterations, password_hash FROM sp_teacher_credentials WHERE teacher_id=?'
    ).bind(teacher.id).first<{ salt: string; iterations: number; password_hash: string }>();
    const passwordValid = strong
      ? await verifyStrongCredential(password, strong.salt, strong.iterations, strong.password_hash)
      : await verifyLegacyPassword(password, teacher.id, teacher.password);
    if (!passwordValid) {
      await recordLoginFailure(c.env.DB, attemptKey);
      return c.json({ success: false, error: { message: '教員IDまたはパスワードが正しくありません' } }, 401);
    }

    if (!strong) {
      const credential = await createStrongCredential(password);
      await c.env.DB.prepare(`INSERT INTO sp_teacher_credentials
        (teacher_id, salt, iterations, password_hash) VALUES (?, ?, ?, ?)
        ON CONFLICT(teacher_id) DO UPDATE SET salt=excluded.salt, iterations=excluded.iterations,
          password_hash=excluded.password_hash, upgraded_at=CURRENT_TIMESTAMP`)
        .bind(teacher.id, credential.salt, credential.iterations, credential.passwordHash).run();
    }
    await clearLoginFailures(c.env.DB, attemptKey);
    const token = await sign({ sub: teacher.id, role: 'admin', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }, getJwtSecret(c), 'HS256');
    return c.json({ success: true, token, role: 'admin' as const, id: teacher.id, name: teacher.name });
  })

  // 3.1 Student Login
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const { student_id, parent_birthday } = c.req.valid('json');
    const attemptKey = loginAttemptKey(c, 'student', student_id);
    if (await isLoginLimited(c.env.DB, attemptKey)) {
      return c.json({ success: false, error: { message: 'ログイン試行回数が上限に達しました。15分後に再度お試しください' } }, 429);
    }
    
    const student = await c.env.DB.prepare(
      'SELECT * FROM students WHERE id = ? AND parent_birthday = ? AND source_deleted_at IS NULL'
    )
      .bind(student_id, parent_birthday)
      .first<{ name: string }>();

    if (!student) {
      await recordLoginFailure(c.env.DB, attemptKey);
      return c.json(
        { success: false, error: { message: '学籍番号または誕生日が正しくありません' } },
        401
      );
    }

    await clearLoginFailures(c.env.DB, attemptKey);
    const token = await sign({ sub: student_id, role: 'student', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }, getJwtSecret(c), 'HS256');
    return c.json({ success: true, token, role: 'student' as const, id: student_id, name: student.name });
  })

  // 3.2 Company Search (gBizINFO or Mock Fallback)
  .get('/search', async (c) => {
    const name = c.req.query('name') || '';
    return c.json(await searchCompanies(name, c.env.GBIZINFO_API_KEY));
  })

  .get('/admin/teachers', async (c) => {
    const { results } = await c.env.DB.prepare(`SELECT id, name, source_managed, is_active,
      source_deleted_at, synced_at FROM teachers ORDER BY is_active DESC, name, id`).all<TeacherAccount>();
    return c.json({ teachers: results || [] });
  })

  .post('/admin/teachers', zValidator('json', createTeacherSchema), async (c) => {
    const auth = c.get('auth');
    const { id, name, temporary_password: temporaryPassword } = c.req.valid('json');
    const existing = await c.env.DB.prepare('SELECT id FROM teachers WHERE lower(id)=lower(?)').bind(id).first();
    if (existing) {
      return c.json({ success: false, error: { message: '同じ教員IDが既に存在します' } }, 409);
    }
    const credential = await createStrongCredential(temporaryPassword);
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO teachers
        (id, name, password, source_managed, is_active, created_by, source_deleted_at, synced_at)
        VALUES (?, ?, '', 0, 1, ?, NULL, CURRENT_TIMESTAMP)`).bind(id, name, auth.sub),
      c.env.DB.prepare(`INSERT INTO sp_teacher_credentials
        (teacher_id, salt, iterations, password_hash) VALUES (?, ?, ?, ?)`)
        .bind(id, credential.salt, credential.iterations, credential.passwordHash),
      c.env.DB.prepare(`INSERT INTO teacher_account_events
        (teacher_id, action, actor_teacher_id) VALUES (?, 'created', ?)`).bind(id, auth.sub),
    ]);
    return c.json({ success: true, id }, 201);
  })

  .patch('/admin/teachers/:id', zValidator('json', updateTeacherAccessSchema), async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const { is_active: isActive } = c.req.valid('json');
    const teacher = await c.env.DB.prepare('SELECT id, is_active FROM teachers WHERE id=?')
      .bind(id).first<{ id: string; is_active: number }>();
    if (!teacher) return c.json({ success: false, error: { message: '教職員が見つかりません' } }, 404);
    if (!isActive && id === auth.sub) {
      return c.json({ success: false, error: { message: 'ログイン中の自分自身は無効化できません' } }, 409);
    }
    if (!isActive) {
      const active = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM teachers
        WHERE is_active=1 AND source_deleted_at IS NULL`).first<{ count: number }>();
      if ((active?.count || 0) <= 1) {
        return c.json({ success: false, error: { message: '最後の有効な教職員は無効化できません' } }, 409);
      }
    }
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE teachers SET is_active=? WHERE id=?').bind(isActive ? 1 : 0, id),
      c.env.DB.prepare(`INSERT INTO teacher_account_events
        (teacher_id, action, actor_teacher_id) VALUES (?, ?, ?)`)
        .bind(id, isActive ? 'enabled' : 'disabled', auth.sub),
    ]);
    return c.json({ success: true });
  })

  .delete('/admin/teachers/:id', async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    if (id === auth.sub) {
      return c.json({ success: false, error: { message: 'ログイン中の自分自身は削除できません' } }, 409);
    }
    const teacher = await c.env.DB.prepare('SELECT id, is_active FROM teachers WHERE id=?')
      .bind(id).first<{ id: string; is_active: number }>();
    if (!teacher) return c.json({ success: false, error: { message: '教職員が見つかりません' } }, 404);
    if (teacher.is_active) {
      const active = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM teachers
        WHERE is_active=1 AND source_deleted_at IS NULL`).first<{ count: number }>();
      if ((active?.count || 0) <= 1) {
        return c.json({ success: false, error: { message: '最後の有効な教職員は削除できません' } }, 409);
      }
    }
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE teachers SET is_active=0 WHERE id=?').bind(id),
      c.env.DB.prepare(`INSERT INTO teacher_account_events
        (teacher_id, action, actor_teacher_id) VALUES (?, 'disabled', ?)`).bind(id, auth.sub),
    ]);
    return c.json({ success: true });
  })

  // 3.3 Kanban Card Management
  // GET /cards (Get all cards or for specific student)
  .get('/cards', async (c) => {
    const studentId = c.req.query('student_id');
    const auth = c.get('auth');
    if (auth.role === 'student' && studentId !== auth.sub) {
      return c.json({ success: false, error: { message: '他の学生の情報は参照できません' } }, 403);
    }
    
    let query = `SELECT a.id, a.student_id, a.company_name, a.hojin_number,
      COALESCE(o.job_title, a.job_title) AS job_title,
      COALESCE(o.status, a.status) AS status,
      COALESCE(o.current_step, a.current_step) AS current_step,
      COALESCE(o.steps_json, a.steps_json) AS steps_json,
      COALESCE(o.memo, a.memo) AS memo,
      COALESCE(o.updated_at, a.updated_at) AS updated_at
      FROM applications a LEFT JOIN application_overrides o ON o.application_id = a.id
      WHERE a.source_deleted_at IS NULL`;
    let bindings: string[] = [];
    
    if (studentId) {
      query += ' AND a.student_id = ?';
      bindings.push(studentId);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const { results } = await c.env.DB.prepare(query)
      .bind(...bindings)
      .all<ApplicationCard>();

    // Map DB status ("予定", "選考中", "内定", "終了") to columns:
    // "選考中" column maps both "予定" and "選考中"
    const columns: Record<'選考中' | '内定' | '終了', ApplicationCard[]> = {
      '選考中': [],
      '内定': [],
      '終了': [],
    };

    for (const card of results || []) {
      const status = card.status;
      if (status === '予定' || status === '選考中') {
        columns['選考中'].push(card);
      } else if (status === '内定') {
        columns['内定'].push(card);
      } else if (status === '終了') {
        columns['終了'].push(card);
      }
    }

    return c.json(columns);
  })

  // POST /cards (Create a card)
  .post('/cards', zValidator('json', createCardSchema), async (c) => {
    const { student_id, company_name, hojin_number } = c.req.valid('json');
    const auth = c.get('auth');
    if (auth.role === 'student' && student_id !== auth.sub) {
      return c.json({ success: false, error: { message: '他の学生には登録できません' } }, 403);
    }

    // Student existence check
    const student = await c.env.DB.prepare('SELECT id FROM students WHERE id = ?')
      .bind(student_id)
      .first();
    if (!student) {
      return c.json(
        { success: false, error: { message: '学生が見つかりません。先に登録してください。' } },
        400
      );
    }

    // Limit check (max 30 cards)
    const { count } = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM applications WHERE student_id = ?'
    )
      .bind(student_id)
      .first<{ count: number }>() || { count: 0 };

    if (count >= 30) {
      return c.json(
        { success: false, error: { message: '登録できる企業数は最大30社までです。' } },
        400
      );
    }

    const next = await c.env.DB.prepare('SELECT COALESCE(MIN(id), 0) - 1 AS id FROM applications').first<{ id: number }>();
    const localId = Math.min(next?.id ?? -1, -1);
    await c.env.DB.prepare(
      'INSERT INTO applications (id, student_id, company_name, hojin_number, status, current_step, steps_json, memo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(localId, student_id, company_name, hojin_number || null, '予定', '未着手', '[]', '')
      .run();

    return c.json({ success: true, id: localId });
  })

  // PATCH /cards/:id (Update card details)
  .patch('/cards/:id', zValidator('json', updateCardSchema), async (c) => {
    const id = c.req.param('id');
    const updates = c.req.valid('json');
    const auth = c.get('auth');
    const owner = await c.env.DB.prepare('SELECT student_id FROM applications WHERE id = ? AND source_deleted_at IS NULL')
      .bind(id).first<{ student_id: string }>();
    if (!owner) return c.json({ success: false, error: { message: 'カードが見つかりません' } }, 404);
    if (auth.role === 'student' && owner.student_id !== auth.sub) {
      return c.json({ success: false, error: { message: '他の学生のカードは更新できません' } }, 403);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let derivedCurrentStep: string | undefined;

    let finalStatus = updates.status;
    let parsedState: ReturnType<typeof deriveApplicationState> | undefined;
    if (finalStatus === undefined && updates.steps_json !== undefined) {
      try {
        parsedState = deriveApplicationState(JSON.parse(updates.steps_json || '[]'));
        finalStatus = parsedState.status;
      } catch {}
    }

    if (finalStatus !== undefined) {
      fields.push('status = ?');
      values.push(finalStatus);
    }
    if (updates.job_title !== undefined) {
      fields.push('job_title = ?');
      values.push(updates.job_title);
    }
    if (updates.steps_json !== undefined) {
      fields.push('steps_json = ?');
      values.push(updates.steps_json);
      
      // Keep current_step in sync if possible
      try {
        const steps = JSON.parse(updates.steps_json || '[]');
        if (Array.isArray(steps) && steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          derivedCurrentStep = parsedState?.currentStep || lastStep.name || '未着手';
          fields.push('current_step = ?');
          values.push(derivedCurrentStep);
        }
      } catch {}
    }
    if (updates.memo !== undefined) {
      fields.push('memo = ?');
      values.push(updates.memo);
    }

    if (fields.length === 0) {
      return c.json({ success: true });
    }

    if (Number(id) < 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await c.env.DB.prepare(`UPDATE applications SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    } else {
      const existing = await c.env.DB.prepare('SELECT * FROM application_overrides WHERE application_id = ?')
        .bind(id).first<Record<string, unknown>>();
      const merged: Record<string, unknown> = { ...(existing || {}), ...updates };
      if (finalStatus !== undefined) merged.status = finalStatus;
      if (derivedCurrentStep !== undefined) merged.current_step = derivedCurrentStep;
      if (updates.job_title === null) merged.job_title = '';
      if (updates.memo === null) merged.memo = '';
      if (updates.steps_json === null) {
        merged.steps_json = '[]';
        merged.current_step = '未着手';
      }
      await c.env.DB.prepare(`INSERT INTO application_overrides
        (application_id, status, job_title, current_step, steps_json, memo, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(application_id) DO UPDATE SET
          status=excluded.status, job_title=excluded.job_title, current_step=excluded.current_step,
          steps_json=excluded.steps_json, memo=excluded.memo, updated_at=CURRENT_TIMESTAMP`)
        .bind(id, merged.status ?? null, merged.job_title ?? null, merged.current_step ?? null,
          merged.steps_json ?? null, merged.memo ?? null).run();
    }

    return c.json({ success: true });
  })

  // 3.4 Admin - Students List
  .get(
    '/admin/students',
    zValidator('query', z.object({ admin_id: z.string() })),
    async (c) => {
      const { admin_id: adminId } = c.req.valid('query');
      const expected = c.env.ADMIN_ID || 'admin';
      if (!isAuthorizedAdmin(adminId, expected)) {
        return c.json(
          { success: false, error: { message: '管理者権限がありません', code: 'UNAUTHORIZED' } },
          401
        );
      }

      const { results } = await c.env.DB.prepare(`
        SELECT 
          s.id AS student_id,
          s.name AS student_name,
          COALESCE(so.parent_email, s.parent_email) AS parent_email,
          COALESCE(so.is_completed, s.is_completed) AS is_completed,
          IFNULL(SUM(CASE WHEN COALESCE(ao.status, a.status) IN ('予定', '選考中') THEN 1 ELSE 0 END), 0) AS active_count,
          IFNULL(SUM(CASE WHEN COALESCE(ao.status, a.status) = '内定' THEN 1 ELSE 0 END), 0) AS offer_count,
          IFNULL(SUM(CASE WHEN COALESCE(ao.status, a.status) = '終了' THEN 1 ELSE 0 END), 0) AS closed_count,
          MAX(COALESCE(ao.updated_at, a.updated_at)) AS last_updated,
          GROUP_CONCAT(CASE WHEN COALESCE(ao.status, a.status) IN ('予定', '選考中') THEN COALESCE(ao.current_step, a.current_step) END, ',') AS active_steps
        FROM students s
        LEFT JOIN student_overrides so ON so.student_id = s.id
        LEFT JOIN applications a ON s.id = a.student_id AND a.source_deleted_at IS NULL
        LEFT JOIN application_overrides ao ON ao.application_id = a.id
        WHERE s.source_deleted_at IS NULL
        GROUP BY s.id
      `).all<AdminStudentSummary>();

      return c.json({ students: results || [] });
    }
  )

  // 3.4 Admin - Matrix
  .get(
    '/admin/matrix',
    zValidator('query', z.object({ admin_id: z.string() })),
    async (c) => {
      const { admin_id: adminId } = c.req.valid('query');
      const expected = c.env.ADMIN_ID || 'admin';
      if (!isAuthorizedAdmin(adminId, expected)) {
        return c.json(
          { success: false, error: { message: '管理者権限がありません', code: 'UNAUTHORIZED' } },
          401
        );
      }

      const { results } = await c.env.DB.prepare(`
        SELECT 
          a.company_name,
          a.hojin_number,
          COALESCE(ao.status, a.status) AS status,
          a.student_id,
          s.name AS student_name
        FROM applications a
        JOIN students s ON a.student_id = s.id
        LEFT JOIN application_overrides ao ON ao.application_id = a.id
        WHERE a.source_deleted_at IS NULL AND s.source_deleted_at IS NULL
      `).all<CompanyMatrixItem>();

      return c.json({ matrix: results || [] });
    }
  )

  // 3.4 Admin - Bulk student import
  .post(
    '/admin/students/bulk',
    zValidator('query', z.object({ admin_id: z.string() })),
    zValidator('json', bulkImportSchema),
    async (c) => {
      const { admin_id: adminId } = c.req.valid('query');
      const expected = c.env.ADMIN_ID || 'admin';
      if (!isAuthorizedAdmin(adminId, expected)) {
        return c.json(
          { success: false, error: { message: '管理者権限がありません', code: 'UNAUTHORIZED' } },
          401
        );
      }

      const { csv } = c.req.valid('json');
      const lines = csv.split('\n').map((line) => line.trim()).filter(Boolean);

      const statements = [];
      let count = 0;

      for (const line of lines) {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          const id = parts[0];
          const name = parts[1];
          const birthday = parts[2] || '0000'; // Default if missing
          
          statements.push(
            c.env.DB.prepare(
              `INSERT INTO students (id, name, parent_birthday, source_managed)
               VALUES (?, ?, ?, 0)
               ON CONFLICT(id) DO UPDATE SET name=excluded.name, parent_birthday=excluded.parent_birthday`
            ).bind(id, name, birthday)
          );
          count++;
        }
      }

      if (statements.length > 0) {
        await c.env.DB.batch(statements);
      }

      return c.json({ success: true, count });
    }
  )

  // 3.4 Admin - Update Student Info
  .patch(
    '/admin/students/:id',
    zValidator('query', z.object({ admin_id: z.string() })),
    zValidator('json', updateStudentSchema),
    async (c) => {
      const { admin_id: adminId } = c.req.valid('query');
      const expected = c.env.ADMIN_ID || 'admin';
      if (!isAuthorizedAdmin(adminId, expected)) {
        return c.json(
          { success: false, error: { message: '管理者権限がありません', code: 'UNAUTHORIZED' } },
          401
        );
      }

      const id = c.req.param('id');
      const { is_completed, parent_email } = c.req.valid('json');

      if (is_completed === undefined && parent_email === undefined) {
        return c.json({ success: true });
      }
      const existing = await c.env.DB.prepare('SELECT parent_email, is_completed FROM student_overrides WHERE student_id = ?')
        .bind(id).first<{ parent_email: string | null; is_completed: number | null }>();
      await c.env.DB.prepare(`INSERT INTO student_overrides (student_id, parent_email, is_completed, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(student_id) DO UPDATE SET parent_email=excluded.parent_email,
          is_completed=excluded.is_completed, updated_at=CURRENT_TIMESTAMP`)
        .bind(id, parent_email !== undefined ? (parent_email ?? '') : existing?.parent_email ?? null,
          is_completed !== undefined ? is_completed : existing?.is_completed ?? null).run();

      return c.json({ success: true });
    }
  )

  // 3.4 Admin - Delete Student
  .delete(
    '/admin/students/:id',
    zValidator('query', z.object({ admin_id: z.string() })),
    async (c) => {
      const { admin_id: adminId } = c.req.valid('query');
      const expected = c.env.ADMIN_ID || 'admin';
      if (!isAuthorizedAdmin(adminId, expected)) {
        return c.json(
          { success: false, error: { message: '管理者権限がありません', code: 'UNAUTHORIZED' } },
          401
        );
      }

      const id = c.req.param('id');
      const source = await c.env.DB.prepare('SELECT source_managed FROM students WHERE id = ?').bind(id)
        .first<{ source_managed: number }>();
      if (source?.source_managed) {
        return c.json({ success: false, error: { message: 'app由来の学生はSPから削除できません' } }, 409);
      }
      await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM applications WHERE student_id = ?').bind(id),
        c.env.DB.prepare('DELETE FROM students WHERE id = ?').bind(id),
      ]);

      return c.json({ success: true });
    }
  )

  // 3.4 Admin - Get Templates
  .get(
    '/admin/templates',
    zValidator('query', z.object({ admin_id: z.string() })),
    async (c) => {
      const { admin_id: adminId } = c.req.valid('query');
      const expected = c.env.ADMIN_ID || 'admin';
      if (!isAuthorizedAdmin(adminId, expected)) {
        return c.json(
          { success: false, error: { message: '管理者権限がありません', code: 'UNAUTHORIZED' } },
          401
        );
      }

      const { results } = await c.env.DB.prepare(
        'SELECT key, value FROM mail_templates'
      ).all<{ key: string; value: string }>();

      const templates: Record<string, string> = {};
      for (const row of results || []) {
        templates[row.key] = row.value;
      }

      return c.json({ templates });
    }
  )

  // 3.4 Admin - Save Templates
  .post(
    '/admin/templates',
    zValidator('query', z.object({ admin_id: z.string() })),
    zValidator('json', saveTemplatesSchema),
    async (c) => {
      const { admin_id: adminId } = c.req.valid('query');
      const expected = c.env.ADMIN_ID || 'admin';
      if (!isAuthorizedAdmin(adminId, expected)) {
        return c.json(
          { success: false, error: { message: '管理者権限がありません', code: 'UNAUTHORIZED' } },
          401
        );
      }

      const { templates } = c.req.valid('json');
      const statements = [];

      for (const [key, value] of Object.entries(templates)) {
        statements.push(
          c.env.DB.prepare(
            'INSERT OR REPLACE INTO mail_templates (key, value) VALUES (?, ?)'
          ).bind(key, value)
        );
      }

      if (statements.length > 0) {
        await c.env.DB.batch(statements);
      }

      return c.json({ success: true });
    }
  )

  // 3.4 Admin - Send Email via GAS Webhook
  .post(
    '/admin/send-email',
    zValidator('query', z.object({ admin_id: z.string() })),
    zValidator('json', sendEmailSchema),
    async (c) => {
      const { admin_id: adminId } = c.req.valid('query');
      const expected = c.env.ADMIN_ID || 'admin';
      if (!isAuthorizedAdmin(adminId, expected)) {
        return c.json(
          { success: false, error: { message: '管理者権限がありません', code: 'UNAUTHORIZED' } },
          401
        );
      }

      const { to, subject, body } = c.req.valid('json');

      const gasUrl = c.env.GAS_EMAIL_URL;
      const token = c.env.GAS_SECRET_TOKEN;

      if (!gasUrl) {
        console.log('GAS_EMAIL_URL is not set. Email logged locally:');
        console.log(`To: ${to}\nSubject: ${subject}\nBody:\n${body}`);
        return c.json({ success: true, mocked: true });
      }

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          to,
          subject,
          body,
        }),
      });

      if (!response.ok) {
        throw new Error(`GAS Webhook failed with status ${response.status}`);
      }

      return c.json({ success: true });
    }
  );

export type AppType = typeof routes;
export { app };
export default {
  fetch: app.fetch,
  scheduled: (_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
    ctx.waitUntil(syncSourceToSp(env));
  },
};
