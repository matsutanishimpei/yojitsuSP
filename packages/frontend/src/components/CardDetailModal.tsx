import React, { useState, useEffect } from 'react';
import client from '../lib/hc';
import { ApplicationCard, ApplicationStep } from '@my-app/shared';
import { X, Plus, Trash2, Check, AlertCircle } from 'lucide-react';

interface CardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: ApplicationCard;
  onCardUpdated: () => void;
  isReadOnly: boolean;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  isOpen,
  onClose,
  card,
  onCardUpdated,
  isReadOnly,
}) => {
  const [jobTitle, setJobTitle] = useState(card.job_title || '');
  const [memo, setMemo] = useState(card.memo || '');
  const [steps, setSteps] = useState<ApplicationStep[]>([]);

  // New step inputs
  const [newStepDate, setNewStepDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStepName, setNewStepName] = useState('');
  const [newStepResult, setNewStepResult] = useState<'' | '合格' | '不合格' | '辞退'>('');

  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setJobTitle(card.job_title || '');
    setMemo(card.memo || '');
    try {
      setSteps(JSON.parse(card.steps_json || '[]'));
    } catch {
      setSteps([]);
    }
  }, [card]);

  if (!isOpen) return null;

  const handlePatch = async (updates: any) => {
    setSavingStatus('saving');
    try {
      const res = await client.api.cards[':id'].$patch({
        param: { id: card.id.toString() },
        json: updates,
      });
      if (res.ok) {
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus('idle'), 2000);
        onCardUpdated();
      } else {
        setSavingStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSavingStatus('error');
    }
  };

  const handleBlurJobTitle = () => {
    if (jobTitle !== card.job_title) {
      handlePatch({ job_title: jobTitle });
    }
  };

  const handleBlurMemo = () => {
    if (memo !== card.memo) {
      handlePatch({ memo });
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepName.trim()) return;

    const newStep: ApplicationStep = {
      date: newStepDate,
      name: newStepName.trim(),
      result: newStepResult,
    };

    const updatedSteps = [...steps, newStep].sort((a, b) => a.date.localeCompare(b.date));
    setSteps(updatedSteps);
    setNewStepName('');
    setNewStepResult('');

    await handlePatch({ steps_json: JSON.stringify(updatedSteps) });
  };

  const handleDeleteStep = async (indexToDelete: number) => {
    const updatedSteps = steps.filter((_, idx) => idx !== indexToDelete);
    setSteps(updatedSteps);
    await handlePatch({ steps_json: JSON.stringify(updatedSteps) });
  };

  const getStepParts = (name: string) => {
    let temp = name.replace(/ES・履歴書/g, '__ES_RIREKI__');
    const parts = temp.split(/[・,、+＆&]+/).map(p => p.trim()).filter(Boolean);
    return parts.map(p => p.replace(/__ES_RIREKI__/g, 'ES・履歴書'));
  };

  const handleTagClick = (tag: string) => {
    if (!newStepName.trim()) {
      setNewStepName(tag);
      return;
    }

    const currentParts = getStepParts(newStepName);
    if (currentParts.includes(tag)) {
      const remaining = currentParts.filter(p => p !== tag);
      setNewStepName(remaining.join('・'));
    } else {
      setNewStepName([...currentParts, tag].join('・'));
    }
  };

  const getResultBadgeClass = (result: string) => {
    switch (result) {
      case '合格': return 'badge-green';
      case '不合格': return 'badge-red';
      case '辞退': return 'badge-gray';
      default: return 'badge-teal';
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{card.company_name}</h3>
            {card.hojin_number && (
              <p className="text-tertiary" style={{ fontSize: '0.8rem' }}>法人番号: {card.hojin_number}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Auto Saving Status Indicator */}
            {savingStatus === 'saving' && <span className="text-muted" style={{ fontSize: '0.8rem' }}>保存中...</span>}
            {savingStatus === 'saved' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={14} /> 保存されました
              </span>
            )}
            {savingStatus === 'error' && (
              <span style={{ fontSize: '0.8rem', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={14} /> 保存に失敗しました
              </span>
            )}
            <button className="btn btn-icon" onClick={onClose} style={{ border: 'none' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Job Title */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="modal_job_title">希望職種・ポジション</label>
            <input
              id="modal_job_title"
              type="text"
              className="form-control"
              placeholder="例: SE, 総合職, 開発職"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onBlur={handleBlurJobTitle}
              disabled={isReadOnly}
            />
          </div>

          {/* Memo / Notes */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="modal_memo">メモ・所感</label>
            <textarea
              id="modal_memo"
              className="form-control"
              rows={4}
              placeholder="進捗状況、面接で聞かれたこと、次回までの課題など..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onBlur={handleBlurMemo}
              disabled={isReadOnly}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Selection Steps History */}
          <div>
            <label className="form-group" style={{ display: 'block', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              選考ステップ履歴
            </label>

            {/* Step list */}
            {steps.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '16px' }}>
                登録されている選考履歴はありません。
              </p>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '16px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-base)',
                padding: '12px',
                backgroundColor: 'var(--bg-primary)'
              }}>
                {steps.map((step, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    borderBottom: idx === steps.length - 1 ? 'none' : '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="text-muted" style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{step.date}</span>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{step.name}</span>
                      {step.result && (
                        <span className={`badge ${getResultBadgeClass(step.result)}`}>{step.result}</span>
                      )}
                    </div>
                    {!isReadOnly && (
                      <button className="btn btn-icon" onClick={() => handleDeleteStep(idx)} style={{ color: '#991B1B', border: 'none', background: 'transparent' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Step Form */}
            {!isReadOnly && (
              <form onSubmit={handleAddStep} style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                backgroundColor: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: 'var(--radius-base)'
              }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="step_date" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>日付</label>
                  <input
                    id="step_date"
                    type="date"
                    className="form-control"
                    style={{ padding: '6px 10px', fontSize: '0.875rem' }}
                    value={newStepDate}
                    onChange={(e) => setNewStepDate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label htmlFor="step_name" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>選考内容</label>
                  <input
                    id="step_name"
                    type="text"
                    className="form-control"
                    placeholder="下のボタンから選考内容を選択してください"
                    style={{ padding: '6px 10px', fontSize: '0.875rem', backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                    value={newStepName}
                    readOnly
                    required
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {['説明会', 'ES・履歴書', '適性検査', '1次面接', '2次面接', '最終面接', '面談'].map((s) => {
                      const isActive = getStepParts(newStepName).includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleTagClick(s)}
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            border: isActive ? '1px solid transparent' : '1px solid var(--border-subtle)',
                            borderRadius: '12px',
                            backgroundColor: isActive ? 'var(--brand-primary)' : 'var(--bg-primary)',
                            color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                            fontWeight: isActive ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 1.2 }}>
                  <label htmlFor="step_result" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>結果</label>
                  <select
                    id="step_result"
                    className="form-control"
                    style={{ padding: '6px 10px', fontSize: '0.875rem' }}
                    value={newStepResult}
                    onChange={(e) => setNewStepResult(e.target.value as any)}
                  >
                    <option value="">結果待ち</option>
                    <option value="合格">合格</option>
                    <option value="不合格">不合格</option>
                    <option value="辞退">辞退</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px', marginTop: '22px' }}>
                  <Plus size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
