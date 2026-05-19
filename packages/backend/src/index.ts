import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
  loginSchema,
  createCardSchema,
  updateCardSchema,
  updateStudentSchema,
  bulkImportSchema,
  saveTemplatesSchema,
  sendEmailSchema,
} from '@my-app/shared';

type Bindings = {
  DB: D1Database;
  ADMIN_ID: string;
  GAS_EMAIL_URL: string;
  GAS_SECRET_TOKEN: string;
  GBIZINFO_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

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
  return adminId && adminId === expectedAdminId;
};

// Mock Companies Fallback List
const MOCK_COMPANIES = [
  { name: 'キャロルシステム株式会社', number: '3011001006461' },
  { name: '株式会社共立ソリューションズ', number: '4010001066795' },
  { name: '株式会社アイエスエフネット', number: '5010401052220' },
  { name: '株式会社テクノプロ', number: '1010001140685' },
  { name: '日本システムウエア株式会社', number: '8011001003884' },
  { name: '伊藤忠テクノソリューションズ株式会社', number: '3010401050212' },
  { name: 'トランスコスモス株式会社', number: '3011101004696' },
  { name: '株式会社システナ', number: '8010401056581' },
  { name: 'ＳＣＳＫ株式会社', number: '6010001142995' },
  { name: '株式会社大塚商会', number: '1010001015694' },
  { name: '富士ソフト株式会社', number: '5020001026038' },
  { name: '株式会社エヌ・ティ・ティ・データ', number: '9010001046390' }
];

const routes = app
  .get('/hello', (c) => {
    return c.json({ message: 'Hello Hono!' });
  })

  // 3.1 Student Login
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const { student_id, parent_birthday } = c.req.valid('json');
    
    const student = await c.env.DB.prepare(
      'SELECT * FROM students WHERE id = ? AND parent_birthday = ?'
    )
      .bind(student_id, parent_birthday)
      .first<{ name: string }>();

    if (!student) {
      return c.json(
        { success: false, error: { message: '学籍番号または誕生日が正しくありません' } },
        401
      );
    }

    return c.json({ success: true, name: student.name });
  })

  // 3.2 Company Search (gBizINFO or Mock Fallback)
  .get('/search', async (c) => {
    const name = c.req.query('name') || '';
    if (!name) {
      return c.json([]);
    }

    // Try gBizINFO API
    try {
      const url = `https://info.gbiz.go.jp/hojin/v1/hojin?name=${encodeURIComponent(name)}&limit=10`;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      const apiKey = c.env.GBIZINFO_API_KEY;
      if (apiKey) {
        headers['X-gbizinfo-key'] = apiKey;
      }

      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data && data['hojin-infos']) {
          const results = data['hojin-infos'].map((info: any) => ({
            name: info.name || '',
            number: info.corporate_number || '',
          }));
          return c.json(results);
        }
      }
    } catch (e) {
      console.warn('gBizINFO API fetch failed, falling back to mock search:', e);
    }

    // Local Mock Fallback Search
    const query = name.toLowerCase();
    const results = MOCK_COMPANIES.filter(
      (comp) =>
        comp.name.toLowerCase().includes(query) ||
        comp.number.includes(query)
    );
    
    return c.json(results);
  })

  // 3.3 Kanban Card Management
  // GET /cards (Get all cards or for specific student)
  .get('/cards', async (c) => {
    const studentId = c.req.query('student_id');
    
    let query = 'SELECT * FROM applications';
    let bindings: string[] = [];
    
    if (studentId) {
      query += ' WHERE student_id = ?';
      bindings.push(studentId);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const { results } = await c.env.DB.prepare(query)
      .bind(...bindings)
      .all<any>();

    // Map DB status ("予定", "選考中", "内定", "終了") to columns:
    // "選考中" column maps both "予定" and "選考中"
    const columns: Record<string, any[]> = {
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

    const info = await c.env.DB.prepare(
      'INSERT INTO applications (student_id, company_name, hojin_number, status, current_step, steps_json, memo) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(student_id, company_name, hojin_number || null, '予定', '未着手', '[]', '')
      .run();

    return c.json({ success: true, id: Number(info.meta.last_row_id) });
  })

  // PATCH /cards/:id (Update card details)
  .patch('/cards/:id', zValidator('json', updateCardSchema), async (c) => {
    const id = c.req.param('id');
    const updates = c.req.valid('json');

    const fields: string[] = [];
    const values: any[] = [];

    let finalStatus = updates.status;
    if (finalStatus === undefined && updates.steps_json !== undefined) {
      try {
        const steps = JSON.parse(updates.steps_json || '[]');
        if (Array.isArray(steps) && steps.length > 0) {
          const hasFailedOrWithdrawn = steps.some((s: any) => s.result === '不合格' || s.result === '辞退');
          if (hasFailedOrWithdrawn) {
            finalStatus = '終了';
          } else {
            const hasOffer = steps.some((s: any) => s.name === '最終面接' && s.result === '合格');
            if (hasOffer) {
              finalStatus = '内定';
            }
          }
        }
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
          fields.push('current_step = ?');
          values.push(lastStep.name || '未着手');
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

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE applications SET ${fields.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

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
          s.parent_email,
          s.is_completed,
          IFNULL(SUM(CASE WHEN a.status IN ('予定', '選考中') THEN 1 ELSE 0 END), 0) AS active_count,
          IFNULL(SUM(CASE WHEN a.status = '内定' THEN 1 ELSE 0 END), 0) AS offer_count,
          IFNULL(SUM(CASE WHEN a.status = '終了' THEN 1 ELSE 0 END), 0) AS closed_count,
          MAX(a.updated_at) AS last_updated,
          GROUP_CONCAT(CASE WHEN a.status IN ('予定', '選考中') THEN a.current_step END, ',') AS active_steps
        FROM students s
        LEFT JOIN applications a ON s.id = a.student_id
        GROUP BY s.id
      `).all<any>();

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
          a.status,
          a.student_id,
          s.name AS student_name
        FROM applications a
        JOIN students s ON a.student_id = s.id
      `).all<any>();

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
              'INSERT OR REPLACE INTO students (id, name, parent_birthday) VALUES (?, ?, ?)'
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

      const fields: string[] = [];
      const values: any[] = [];

      if (is_completed !== undefined) {
        fields.push('is_completed = ?');
        values.push(is_completed);
      }
      if (parent_email !== undefined) {
        fields.push('parent_email = ?');
        values.push(parent_email);
      }

      if (fields.length === 0) {
        return c.json({ success: true });
      }

      values.push(id);

      await c.env.DB.prepare(
        `UPDATE students SET ${fields.join(', ')} WHERE id = ?`
      )
        .bind(...values)
        .run();

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
      await c.env.DB.prepare('DELETE FROM students WHERE id = ?').bind(id).run();

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
export default app;
