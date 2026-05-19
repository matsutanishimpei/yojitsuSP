import React, { useState, useEffect } from 'react';
import client from '../../lib/hc';
import { Save, Check, AlertCircle, Info } from 'lucide-react';

interface TemplatesEditorProps {
  adminId: string;
}

export const TemplatesEditor: React.FC<TemplatesEditorProps> = ({ adminId }) => {
  const [templates, setTemplates] = useState<Record<string, string>>({
    tplStudentSubject: '',
    tplStudentBody: '',
    tplParent0Subject: '',
    tplParent0Body: '',
    tplParent1Subject: '',
    tplParent1Body: '',
    tplParent3Subject: '',
    tplParent3Body: '',
  });

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await client.api.admin.templates.$get({ query: { admin_id: adminId } });
        if (res.ok) {
          const data = await res.json();
          setTemplates(prev => ({ ...prev, ...data.templates }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [adminId]);

  const handleChange = (key: string, value: string) => {
    setTemplates(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStatus('saving');

    try {
      const res = await client.api.admin.templates.$post({
        query: { admin_id: adminId },
        json: { templates },
      });

      if (res.ok) {
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus('idle'), 2000);
      } else {
        setSavingStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSavingStatus('error');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>読み込み中...</div>;
  }

  const renderTemplateFields = (title: string, subjKey: string, bodyKey: string) => (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        {title}
      </h3>
      <div className="form-group">
        <label htmlFor={subjKey}>件名</label>
        <input
          id={subjKey}
          type="text"
          className="form-control"
          value={templates[subjKey] || ''}
          onChange={(e) => handleChange(subjKey, e.target.value)}
        />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor={bodyKey}>本文</label>
        <textarea
          id={bodyKey}
          className="form-control"
          rows={6}
          value={templates[bodyKey] || ''}
          onChange={(e) => handleChange(bodyKey, e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
        />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '32px', alignItems: 'start' }}>
      <form onSubmit={handleSave}>
        {renderTemplateFields('学生本人宛メールテンプレート', 'tplStudentSubject', 'tplStudentBody')}
        {renderTemplateFields('保護者宛: 選考中 0社 (緊急・冷え冷え)', 'tplParent0Subject', 'tplParent0Body')}
        {renderTemplateFields('保護者宛: 選考中 1〜2社 (要見守り・アドバイス)', 'tplParent1Subject', 'tplParent1Body')}
        {renderTemplateFields('保護者宛: 選考中 3社以上 (順調・ねぎらい)', 'tplParent3Subject', 'tplParent3Body')}

        <div style={{
          position: 'sticky',
          bottom: '24px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '16px',
          backgroundColor: 'var(--bg-surface)',
          padding: '16px 24px',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-base)',
          boxShadow: 'var(--shadow-hover)'
        }}>
          {savingStatus === 'saving' && <span className="text-muted">保存中...</span>}
          {savingStatus === 'saved' && (
            <span style={{ color: 'var(--accent-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={16} /> 保存されました
            </span>
          )}
          {savingStatus === 'error' && (
            <span style={{ color: '#991B1B', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={16} /> 保存に失敗しました
            </span>
          )}

          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
            <Save size={16} />
            <span>設定を保存</span>
          </button>
        </div>
      </form>

      {/* Variables explanation panel */}
      <div className="card" style={{ position: 'sticky', top: '90px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Info size={18} className="text-muted" />
          埋め込み変数
        </h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
          メールテンプレートの件名・本文内に以下の変数を入れることで、送信時に対象学生の情報に自動で置き換わります。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
          <div>
            <code style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>{`{name}`}</code>
            <div style={{ marginTop: '2px' }}>学生氏名</div>
          </div>
          <div>
            <code style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>{`{id}`}</code>
            <div style={{ marginTop: '2px' }}>学籍番号</div>
          </div>
          <div>
            <code style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>{`{date}`}</code>
            <div style={{ marginTop: '2px' }}>本日の日付 (YYYY/MM/DD)</div>
          </div>
          <div>
            <code style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>{`{active_count}`}</code>
            <div style={{ marginTop: '2px' }}>選考中・予定企業数</div>
          </div>
          <div>
            <code style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>{`{offer_count}`}</code>
            <div style={{ marginTop: '2px' }}>内定獲得企業数</div>
          </div>
          <div>
            <code style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>{`{active_list}`}</code>
            <div style={{ marginTop: '2px' }}>選考中の企業一覧（箇条書き）</div>
          </div>
          <div>
            <code style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>{`{offer_list}`}</code>
            <div style={{ marginTop: '2px' }}>内定企業の一覧（箇条書き）</div>
          </div>
          <div>
            <code style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>{`{closed_list}`}</code>
            <div style={{ marginTop: '2px' }}>選考終了した企業の一覧</div>
          </div>
        </div>
      </div>
    </div>
  );
};
