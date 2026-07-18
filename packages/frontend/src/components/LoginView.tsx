import React, { useState } from 'react';
import client from '../lib/hc';
import { LogIn, ShieldAlert } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: { role: 'student' | 'admin'; id: string; name: string; token: string }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [idInput, setIdInput] = useState('');
  const [birthdayInput, setBirthdayInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginMode, setLoginMode] = useState<'student' | 'admin'>('student');
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
      if (loginMode === 'admin') {
        const adminRes = await client.api.admin.login.$post({
          json: { id: idInput.trim(), password: passwordInput },
        });
        if (adminRes.ok) {
          const data = await adminRes.json();
          onLoginSuccess({ role: 'admin', id: data.id, name: data.name, token: data.token });
          return;
        }
        const data = await adminRes.json().catch(() => null) as { error?: { message?: string } } | null;
        setError(data?.error?.message || '教員IDまたはパスワードが正しくありません');
        return;
      }

      if (loginMode === 'student') {
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
              role: 'student', id: data.id, name: data.name || '学生', token: data.token,
            });
          } else {
            setError('ログインに失敗しました');
          }
        } else {
          const data = await studentRes.json().catch(() => ({}));
          const error = data as { error?: { message?: string } };
          setError(error.error?.message || '学籍番号または誕生日が正しくありません');
          setLoading(false);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setError('通信エラーが発生しました。ネットワークを確認してください。');
      setLoading(false);
    } finally {
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
            backgroundColor: '#FEF2F2',
            color: '#991B1B',
            padding: '12px',
            borderRadius: 'var(--radius-base)',
            fontSize: '0.875rem',
            marginBottom: '20px',
            border: '1px solid #FCA5A5'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['student', 'admin'] as const).map((mode) => (
              <button key={mode} type="button" className={`btn ${loginMode === mode ? 'btn-primary' : ''}`}
                style={{ flex: 1 }} onClick={() => { setLoginMode(mode); setError(null); }}>
                {mode === 'student' ? '学生' : '教員'}
              </button>
            ))}
          </div>
          <div className="form-group">
            <label htmlFor="student_id">{loginMode === 'student' ? '学籍番号' : '教員ID'}</label>
            <input
              id="student_id"
              type="text"
              className="form-control"
              placeholder="例: 00ZZ0000"
              value={idInput}
              onChange={(e) => {
                setIdInput(e.target.value);
              }}
              disabled={loading}
              autoFocus
            />
          </div>

          {loginMode === 'student' && (
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

          {loginMode === 'admin' && (
            <div className="form-group">
              <label htmlFor="password">パスワード</label>
              <input id="password" type="password" className="form-control" value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)} disabled={loading} autoComplete="current-password" />
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
