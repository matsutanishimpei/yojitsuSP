import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../lib/hc';

export const HelloView: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [latency, setLatency] = useState<number | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('');

  const testConnection = async () => {
    setLoading(true);
    setStatus('idle');
    setMessage('');
    setErrorMsg('');
    setLatency(null);

    const start = performance.now();
    try {
      // Determine target URL for display purposes
      const targetUrl = (import.meta.env.VITE_API_URL as string) || window.location.origin;
      setApiUrl(`${targetUrl.replace(/\/$/, '')}/api/hello`);

      const res = await client.api.hello.$get();
      const end = performance.now();

      if (res.ok) {
        const data = await res.json();
        setMessage(data.message || '接続成功 (メッセージなし)');
        setLatency(Math.round(end - start));
        setStatus('success');
      } else {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'ネットワークエラーが発生しました');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="flex justify-center items-center min-h-screen bg-stone-50" style={{
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '24px',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radii-card)',
        padding: '32px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        transition: 'all 0.2s ease-in-out'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          API 疎通確認テスト
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          フロントエンドとバックエンド（Workers）の通信テストを行います。
        </p>

        <div style={{
          padding: '16px',
          borderRadius: 'var(--radii-base)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '24px',
          fontSize: '13px',
          wordBreak: 'break-all'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>リクエスト先:</span>
            <code style={{ display: 'block', marginTop: '4px', fontWeight: 500 }}>
              {apiUrl || '取得中...'}
            </code>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>接続状態:</span>
            {loading ? (
              <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                通信中...
              </span>
            ) : status === 'success' ? (
              <span style={{ marginLeft: '8px', color: '#0d9488', fontWeight: 600 }}>
                ● 接続成功 ({latency}ms)
              </span>
            ) : status === 'error' ? (
              <span style={{ marginLeft: '8px', color: '#dc2626', fontWeight: 600 }}>
                ● 接続失敗
              </span>
            ) : (
              <span style={{ marginLeft: '8px', color: 'var(--text-tertiary)' }}>未実行</span>
            )}
          </div>
        </div>

        {status === 'success' && (
          <div style={{
            padding: '16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 'var(--radii-base)',
            color: '#166534',
            fontSize: '14px',
            marginBottom: '24px'
          }}>
            <strong>レスポンス受信:</strong>
            <pre style={{ margin: '8px 0 0 0', fontFamily: 'monospace', fontSize: '13px' }}>
              {JSON.stringify({ message }, null, 2)}
            </pre>
          </div>
        )}

        {status === 'error' && (
          <div style={{
            padding: '16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radii-base)',
            color: '#991b1b',
            fontSize: '14px',
            marginBottom: '24px'
          }}>
            <strong>エラー内容:</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              {errorMsg}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#7f1d1d' }}>
              ※CORS設定、環境変数 VITE_API_URL が正しいか、バックエンドが正常起動しているかご確認ください。
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 'var(--radii-base)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            ログイン画面へ
          </button>
          <button
            onClick={testConnection}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 'var(--radii-base)',
              border: 'none',
              backgroundColor: 'var(--brand-primary)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'テスト中...' : '再テスト'}
          </button>
        </div>
      </div>
    </div>
  );
};
