import React, { useState } from 'react';
import client from '../lib/hc';
import { LogIn, ShieldAlert } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: { role: 'student' | 'admin'; id: string; name: string }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [idInput, setIdInput] = useState('');
  const [birthdayInput, setBirthdayInput] = useState('');
  const [showBirthday, setShowBirthday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idInput.trim()) {
      setError('学籍番号または管理者IDを入力してください');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // 1. Try Admin Login first
      if (!showBirthday) {
        const adminRes = await client.api.admin.students.$get({
          query: { admin_id: idInput.trim() },
        });

        if (adminRes.ok) {
          // Success: Authorized as Admin!
          setLoading(false);
          onLoginSuccess({
            role: 'admin',
            id: idInput.trim(),
            name: '管理者教員',
          });
          return;
        }
        
        // 2. If it's a 401 error, transition to Student Login and request birthday
        if (adminRes.status === 401) {
          setShowBirthday(true);
          setLoading(false);
          setError('学生用ログイン：誕生日の入力が必要です');
          return;
        }
      }

      // 3. Student Login Flow
      if (showBirthday) {
        if (!birthdayInput.trim() || birthdayInput.trim().length !== 4) {
          setError('誕生日は4桁で入力してください (例: 0309)');
          setLoading(false);
          return;
        }

        const studentRes = await client.api.login.$post({
          json: {
            student_id: idInput.trim(),
            parent_birthday: birthdayInput.trim(),
          },
        });

        if (studentRes.ok) {
          const data = await studentRes.json();
          setLoading(false);
          if (data.success) {
            onLoginSuccess({
              role: 'student',
              id: idInput.trim(),
              name: data.name || '学生',
            });
          } else {
            setError('ログインに失敗しました');
          }
        } else {
          const data = await studentRes.json().catch(() => ({}));
          setError(
            (data as any)?.error?.message || 
            '学籍番号または誕生日が正しくありません'
          );
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('通信エラーが発生しました。ネットワークを確認してください。');
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="card login-card">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: '2rem', 
            fontWeight: 700, 
            letterSpacing: '-0.03em',
            marginBottom: '8px'
          }}>
            Yojitsu
          </h1>
          <p className="text-muted">就活状況管理システム</p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: showBirthday && !birthdayInput ? 'var(--bg-secondary)' : '#FEF2F2',
            color: showBirthday && !birthdayInput ? 'var(--text-secondary)' : '#991B1B',
            padding: '12px',
            borderRadius: 'var(--radius-base)',
            fontSize: '0.875rem',
            marginBottom: '20px',
            border: showBirthday && !birthdayInput ? '1px solid var(--border-subtle)' : '1px solid #FCA5A5'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="student_id">学籍番号 または 管理者ID</label>
            <input
              id="student_id"
              type="text"
              className="form-control"
              placeholder="例: 24JZ0128"
              value={idInput}
              onChange={(e) => {
                setIdInput(e.target.value);
                if (showBirthday) setShowBirthday(false);
              }}
              disabled={loading}
              autoFocus
            />
          </div>

          {showBirthday && (
            <div className="form-group">
              <label htmlFor="birthday">親の誕生日 (4桁の数字)</label>
              <input
                id="birthday"
                type="text"
                maxLength={4}
                className="form-control"
                placeholder="例: 0309 (3月9日の場合)"
                value={birthdayInput}
                onChange={(e) => setBirthdayInput(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? '認証中...' : (
              <>
                <LogIn size={18} />
                <span>ログイン</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
