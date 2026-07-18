import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import client from '../../lib/hc';
import type { TeacherAccount } from '@my-app/shared';

interface TeachersManagementProps {
  currentTeacherId: string;
}

export const TeachersManagement: React.FC<TeachersManagementProps> = ({ currentTeacherId }) => {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTeachers = async () => {
    const response = await client.api.admin.teachers.$get();
    if (!response.ok) throw new Error('教職員一覧を取得できませんでした');
    const data = await response.json() as { teachers: TeacherAccount[] };
    setTeachers(data.teachers);
  };

  useEffect(() => {
    loadTeachers().catch((cause) => setError(cause instanceof Error ? cause.message : '読込に失敗しました'));
  }, []);

  const addTeacher = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await client.api.admin.teachers.$post({
        json: { id: id.trim(), name: name.trim(), temporary_password: temporaryPassword },
      });
      const data = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || '教職員を追加できませんでした');
      setId('');
      setName('');
      setTemporaryPassword('');
      setMessage('教職員を追加しました。初期パスワードは安全な方法で本人へ伝えてください。');
      await loadTeachers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '追加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const setAccess = async (teacher: TeacherAccount, active: boolean) => {
    setError(null);
    setMessage(null);
    try {
      const response = await client.api.admin.teachers[':id'].$patch({
        param: { id: teacher.id }, json: { is_active: active },
      });
      const data = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || '状態を変更できませんでした');
      setMessage(`${teacher.name} を${active ? '有効化' : '無効化'}しました。`);
      await loadTeachers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '状態変更に失敗しました');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <section className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <UserPlus size={20} /> 教職員を追加
        </h2>
        <p className="text-muted" style={{ marginBottom: '20px' }}>
          共通のadmin IDは使用できません。個人ごとのIDと12文字以上の初期パスワードを設定してください。
        </p>
        <form onSubmit={addTeacher}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="teacher-id">教員ID</label>
              <input id="teacher-id" className="form-control" value={id} onChange={(e) => setId(e.target.value)}
                minLength={3} maxLength={64} required autoComplete="off" />
            </div>
            <div className="form-group">
              <label htmlFor="teacher-name">氏名</label>
              <input id="teacher-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)}
                maxLength={100} required autoComplete="off" />
            </div>
            <div className="form-group">
              <label htmlFor="teacher-password">初期パスワード</label>
              <input id="teacher-password" type="password" className="form-control" value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)} minLength={12} maxLength={256}
                required autoComplete="new-password" />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            <UserPlus size={16} /> {loading ? '追加中...' : '教職員を追加'}
          </button>
        </form>
      </section>

      {error && <div className="card" style={{ color: '#991B1B', borderColor: '#FCA5A5' }}>{error}</div>}
      {message && <div className="card" style={{ color: '#166534', borderColor: '#86EFAC' }}>{message}</div>}

      <section className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ShieldCheck size={20} /> 登録済み教職員
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '10px' }}>氏名</th><th style={{ padding: '10px' }}>教員ID</th>
              <th style={{ padding: '10px' }}>由来</th><th style={{ padding: '10px' }}>状態</th>
              <th style={{ padding: '10px' }}>操作</th>
            </tr></thead>
            <tbody>{teachers.map((teacher) => {
              const active = teacher.is_active === 1 && !teacher.source_deleted_at;
              const isSelf = teacher.id === currentTeacherId;
              return <tr key={teacher.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 10px' }}>{teacher.name}{isSelf ? '（自分）' : ''}</td>
                <td style={{ padding: '12px 10px' }}><code>{teacher.id}</code></td>
                <td style={{ padding: '12px 10px' }}>{teacher.source_managed ? 'app同期' : 'SP追加'}</td>
                <td style={{ padding: '12px 10px' }}>{active ? '有効' : '無効'}</td>
                <td style={{ padding: '12px 10px' }}>
                  <button className={`btn ${active ? 'btn-danger' : 'btn-accent'}`}
                    disabled={isSelf} onClick={() => setAccess(teacher, !active)}>
                    {active ? '無効化' : '有効化'}
                  </button>
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
