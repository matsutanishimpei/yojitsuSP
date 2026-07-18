import React from 'react';
import type { ApplicationStep, CardsByStatus } from '@my-app/shared';

interface ExpandedDetailProps {
  studentName: string;
  studentId: string;
  loading: boolean;
  cardsData?: CardsByStatus;
}

export const ExpandedDetail: React.FC<ExpandedDetailProps> = ({
  studentName,
  studentId,
  loading,
  cardsData
}) => {
  const getActiveCardsCount = (data?: CardsByStatus) => {
    if (!data) return 0;
    return (data.選考中?.length || 0) + (data.内定?.length || 0) + (data.終了?.length || 0);
  };

  return (
    <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-base)', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{studentName} の受験企業と選考ステップ一覧</span>
      </h4>
      
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic', padding: '12px 0' }}>
          データを読み込み中...
        </div>
      ) : !cardsData || getActiveCardsCount(cardsData) === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic', padding: '12px 0' }}>
          登録されている選考カードがありません。
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {(['選考中', '内定', '終了'] as const).map(columnName => {
            const cards = cardsData[columnName] || [];
            if (cards.length === 0) return null;
            
            return (
              <div key={columnName} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{columnName}</span>
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600 }}>{cards.length}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cards.map((card) => {
                    let steps: ApplicationStep[] = [];
                    try {
                      steps = card.steps_json ? JSON.parse(card.steps_json) as ApplicationStep[] : [];
                    } catch (e) {
                      console.error(e);
                    }
                    
                    return (
                      <div key={card.id} style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-base)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {card.company_name}
                        </div>
                        
                        {card.job_title && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            職種: {card.job_title}
                          </div>
                        )}
                        
                        {steps.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '8px', marginTop: '6px' }}>
                            {steps.map((step, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{step.date.substring(5)}</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)', flex: 1, marginLeft: '8px', textAlign: 'left' }}>{step.name}</span>
                                {step.result && (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    fontWeight: 500,
                                    backgroundColor: step.result === '合格' ? '#D1FAE5' : step.result === '不合格' ? '#FEE2E2' : '#F3F4F6',
                                    color: step.result === '合格' ? '#065F46' : step.result === '不合格' ? '#991B1B' : '#374151',
                                  }}>{step.result}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '4px' }}>
                            選考履歴なし
                          </div>
                        )}

                        {card.memo && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            borderTop: '1px dashed var(--border-subtle)',
                            paddingTop: '8px',
                            marginTop: '8px',
                            whiteSpace: 'pre-wrap',
                            backgroundColor: 'var(--bg-secondary)',
                            padding: '6px 8px',
                            borderRadius: '4px'
                          }}>
                            <strong style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>メモ</strong>
                            {card.memo}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
