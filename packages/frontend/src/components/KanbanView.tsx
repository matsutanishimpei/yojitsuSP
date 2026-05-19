import React, { useState, useEffect, useRef } from 'react';
import client from '../lib/hc';
import { ApplicationCard } from '@my-app/shared';
import { CardDetailModal } from './CardDetailModal';
import { Plus, Search, LogOut, ArrowLeft, Building2, Calendar, FileText, ChevronRight } from 'lucide-react';

interface KanbanViewProps {
  studentId: string;
  studentName: string;
  isReadOnly: boolean;
  onBackToAdmin?: () => void;
  onLogout: () => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  studentId,
  studentName,
  isReadOnly,
  onBackToAdmin,
  onLogout,
}) => {
  const [columns, setColumns] = useState<Record<string, ApplicationCard[]>>({
    '選考中': [],
    '内定': [],
    '終了': [],
  });
  
  // Search & Add states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHojinNumber, setSelectedHojinNumber] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ name: string; number: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Modal states
  const [selectedCard, setSelectedCard] = useState<ApplicationCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<'選考中' | '内定' | '終了' | null>(null);
  
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const fetchCards = async () => {
    try {
      const res = await client.api.cards.$get({
        query: { student_id: studentId },
      });
      if (res.ok) {
        const data = await res.json();
        setColumns({
          '選考中': data['選考中'] || [],
          '内定': data['内定'] || [],
          '終了': data['終了'] || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch cards:', err);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [studentId]);

  // Click outside listener for suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Search Input Change
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSelectedHojinNumber(null); // Clear selected number since typing changed it

    if (val.trim().length >= 2) {
      try {
        const res = await client.api.search.$get({ query: { name: val } });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data as any);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (company: { name: string; number: string }) => {
    setSearchQuery(company.name);
    setSelectedHojinNumber(company.number);
    setShowSuggestions(false);
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isAdding) return;

    setIsAdding(true);
    try {
      const res = await client.api.cards.$post({
        json: {
          student_id: studentId,
          company_name: searchQuery.trim(),
          hojin_number: selectedHojinNumber || undefined,
        },
      });

      if (res.ok) {
        setSearchQuery('');
        setSelectedHojinNumber(null);
        await fetchCards();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert((errData as any)?.error?.message || 'カードの追加に失敗しました。');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, cardId: number) => {
    e.dataTransfer.setData('text/plain', cardId.toString());
  };

  const handleDragOver = (e: React.DragEvent, columnKey: '選考中' | '内定' | '終了') => {
    e.preventDefault();
    if (!isReadOnly && dragOverColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: '選考中' | '内定' | '終了') => {
    e.preventDefault();
    setDragOverColumn(null);
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    // Call API to update status
    // Note: column "選考中" saves status "選考中" to DB
    try {
      const res = await client.api.cards[':id'].$patch({
        param: { id: cardId },
        json: { status: targetColumn },
      });

      if (res.ok) {
        await fetchCards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCard = (card: ApplicationCard) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  return (
    <div className="app-container">
      {/* Read-Only Mode Banner */}
      {isReadOnly && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '10px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)'
        }}>
          <span><strong>閲覧モード:</strong> 教員として {studentName} さんの状況を代理確認しています。編集は行えません。</span>
          {onBackToAdmin && (
            <button className="btn" onClick={onBackToAdmin} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              <ArrowLeft size={14} /> 学生一覧へ戻る
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <header>
        <h1>
          <span>Yojitsu</span>
          <span style={{ fontWeight: 300, color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {studentName} さん ({studentId})
          </span>
        </h1>
        <div className="header-actions">
          {!isReadOnly && (
            <button className="btn" onClick={onLogout}>
              <LogOut size={16} /> ログアウト
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="container">
        {/* Search & Add Section (Hide in read-only mode) */}
        {!isReadOnly && (
          <div className="card" style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600 }}>就活カードを追加する</h3>
            <form onSubmit={handleAddCard} style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, position: 'relative' }} ref={searchContainerRef}>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="企業名を入力して検索（gBizINFOから正式名称を取得）"
                    style={{ paddingLeft: '38px' }}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                  />
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-base)',
                    boxShadow: 'var(--shadow-hover)',
                    zIndex: 20,
                    maxHeight: '240px',
                    overflowY: 'auto'
                  }}>
                    {suggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(item)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                          transition: 'var(--transition-smooth)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.name}</span>
                        <span className="text-tertiary" style={{ fontSize: '0.75rem' }}>{item.number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!searchQuery.trim() || isAdding}
                style={{ padding: '0 24px' }}
              >
                <Plus size={18} /> 追加
              </button>
            </form>
          </div>
        )}

        {/* Kanban Columns */}
        <div className="kanban-grid">
          {(['選考中', '内定', '終了'] as const).map((columnKey) => (
            <div
              key={columnKey}
              className={`kanban-column ${dragOverColumn === columnKey ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, columnKey)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, columnKey)}
            >
              <div className="kanban-column-header">
                <h3 className="kanban-column-title">
                  {columnKey}
                  <span className="badge badge-gray" style={{ fontSize: '0.8rem', padding: '1px 8px' }}>
                    {columns[columnKey]?.length || 0}
                  </span>
                </h3>
              </div>

              <div className="kanban-card-list">
                {columns[columnKey]?.map((card) => (
                  <div
                    key={card.id}
                    className="card kanban-card"
                    draggable={!isReadOnly}
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    onDragEnd={handleDragLeave}
                    onClick={() => handleOpenCard(card)}
                  >
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={16} className="text-muted" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {card.company_name}
                        </span>
                      </h4>
                      {card.job_title && (
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px', paddingLeft: '22px' }}>
                          職種: {card.job_title}
                        </p>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '8px',
                      color: 'var(--text-secondary)'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        {card.current_step || '未着手'}
                      </span>
                      {card.memo && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-muted)' }}>
                          <FileText size={12} />
                          メモあり
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedCard(null);
          }}
          card={selectedCard}
          onCardUpdated={fetchCards}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
};
