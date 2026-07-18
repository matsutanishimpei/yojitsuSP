import type { ApplicationCard } from '@my-app/shared';
import type { Bindings } from './env';

type SourceStudent = {
  id: string; name: string; parent_birthday: string | null; parent_email: string | null;
  is_completed: number; last_login_at: string | null;
};
type SourceTeacher = { id: string; name: string; password: string; last_login_at: string | null };

export class SyncInProgressError extends Error {}

async function notifySyncFailure(env: Bindings, message: string) {
  if (!env.SYNC_ALERT_WEBHOOK) return;
  try {
    await fetch(env.SYNC_ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'yojitsu-sp', event: 'sync_failed', message, occurred_at: new Date().toISOString() }),
    });
  } catch (notifyError) {
    console.error('Failed to send sync alert', notifyError);
  }
}

export async function syncSourceToSp(env: Bindings) {
  const run = await env.DB.prepare("INSERT INTO sync_runs (status) VALUES ('running')").run();
  const runId = Number(run.meta.last_row_id);
  const lock = await env.DB.prepare(`UPDATE sync_lock SET locked_at=CURRENT_TIMESTAMP, run_id=?
    WHERE id=1 AND (locked_at IS NULL OR locked_at < datetime('now', '-30 minutes'))`).bind(runId).run();
  if (!lock.meta.changes) {
    await env.DB.prepare("UPDATE sync_runs SET completed_at=CURRENT_TIMESTAMP, status='skipped', error_message='sync already running' WHERE id=?")
      .bind(runId).run();
    throw new SyncInProgressError('同期処理は既に実行中です');
  }
  try {
    const [students, applications, teachers] = await Promise.all([
      env.SOURCE_DB.prepare('SELECT id, name, parent_birthday, parent_email, is_completed, last_login_at FROM students').all<SourceStudent>(),
      env.SOURCE_DB.prepare('SELECT id, student_id, company_name, job_title, hojin_number, status, current_step, steps_json, memo, updated_at FROM applications').all<ApplicationCard>(),
      env.SOURCE_DB.prepare('SELECT id, name, password, last_login_at FROM teachers').all<SourceTeacher>(),
    ]);

    await env.DB.batch([
      env.DB.prepare('DELETE FROM source_students_stage'),
      env.DB.prepare('DELETE FROM source_applications_stage'),
      env.DB.prepare('DELETE FROM source_teachers_stage'),
    ]);

    for (const student of students.results) {
      await env.DB.prepare(`INSERT INTO source_students_stage
        (id, name, parent_birthday, parent_email, is_completed, last_login_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(student.id, student.name, student.parent_birthday, student.parent_email, student.is_completed, student.last_login_at).run();
    }
    for (const application of applications.results) {
      await env.DB.prepare(`INSERT INTO source_applications_stage
        (id, student_id, company_name, job_title, hojin_number, status, current_step, steps_json, memo, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(application.id, application.student_id, application.company_name, application.job_title,
          application.hojin_number, application.status, application.current_step, application.steps_json,
          application.memo, application.updated_at).run();
    }
    for (const teacher of teachers.results) {
      await env.DB.prepare('INSERT INTO source_teachers_stage (id, name, password, last_login_at) VALUES (?, ?, ?, ?)')
        .bind(teacher.id, teacher.name, teacher.password, teacher.last_login_at).run();
    }

    await env.DB.batch([
      env.DB.prepare("UPDATE students SET source_deleted_at=CURRENT_TIMESTAMP WHERE source_managed=1"),
      env.DB.prepare("UPDATE applications SET source_deleted_at=CURRENT_TIMESTAMP WHERE id > 0"),
      env.DB.prepare("UPDATE teachers SET source_deleted_at=CURRENT_TIMESTAMP WHERE source_managed=1"),
      env.DB.prepare(`INSERT INTO students
        (id, name, parent_birthday, parent_email, is_completed, last_login_at, source_managed, source_deleted_at, synced_at)
        SELECT id, name, parent_birthday, parent_email, is_completed, last_login_at, 1, NULL, CURRENT_TIMESTAMP
        FROM source_students_stage WHERE 1
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, parent_birthday=excluded.parent_birthday,
          parent_email=excluded.parent_email, is_completed=excluded.is_completed, last_login_at=excluded.last_login_at,
          source_managed=1, source_deleted_at=NULL, synced_at=CURRENT_TIMESTAMP`),
      env.DB.prepare(`INSERT INTO applications
        (id, student_id, company_name, job_title, hojin_number, status, current_step, steps_json, memo, updated_at, source_deleted_at, synced_at)
        SELECT id, student_id, company_name, job_title, hojin_number, status, current_step, steps_json, memo, updated_at, NULL, CURRENT_TIMESTAMP
        FROM source_applications_stage WHERE 1
        ON CONFLICT(id) DO UPDATE SET student_id=excluded.student_id, company_name=excluded.company_name,
          job_title=excluded.job_title, hojin_number=excluded.hojin_number, status=excluded.status,
          current_step=excluded.current_step, steps_json=excluded.steps_json, memo=excluded.memo,
          updated_at=excluded.updated_at, source_deleted_at=NULL, synced_at=CURRENT_TIMESTAMP`),
      env.DB.prepare(`INSERT INTO teachers
        (id, name, password, last_login_at, source_deleted_at, synced_at, source_managed, is_active)
        SELECT id, name, password, last_login_at, NULL, CURRENT_TIMESTAMP, 1,
          CASE WHEN lower(id) IN ('admin', 'administrator', 'root') THEN 0 ELSE 1 END
        FROM source_teachers_stage WHERE 1
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, password=excluded.password,
          last_login_at=excluded.last_login_at, source_deleted_at=NULL, synced_at=CURRENT_TIMESTAMP,
          source_managed=1`),
      env.DB.prepare(`UPDATE sync_runs SET completed_at=CURRENT_TIMESTAMP, status='success',
        students_count=?, applications_count=?, teachers_count=? WHERE id=?`)
        .bind(students.results.length, applications.results.length, teachers.results.length, runId),
      env.DB.prepare('UPDATE sync_lock SET locked_at=NULL, run_id=NULL WHERE id=1 AND run_id=?').bind(runId),
    ]);
    return { students: students.results.length, applications: applications.results.length, teachers: teachers.results.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await env.DB.batch([
      env.DB.prepare("UPDATE sync_runs SET completed_at=CURRENT_TIMESTAMP, status='failed', error_message=? WHERE id=?").bind(message, runId),
      env.DB.prepare('UPDATE sync_lock SET locked_at=NULL, run_id=NULL WHERE id=1 AND run_id=?').bind(runId),
    ]);
    await notifySyncFailure(env, message);
    throw error;
  }
}
