import React, { useState, useEffect } from 'react';
import client from '../../lib/hc';
import { Upload, Trash2, ArrowUpDown, CheckSquare, Square, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { ImportModal } from './StudentsList/ImportModal';
import { ExpandedDetail } from './StudentsList/ExpandedDetail';
import type { AdminStudentSummary, CardsByStatus } from '@my-app/shared';

type StudentStat = AdminStudentSummary;

interface StudentsListProps {
  adminId: string;
  onSelectStudent: (student: { id: string; name: string }) => void;
}

type SortField = 'student_id' | 'student_name' | 'active_count' | 'offer_count' | 'total_count' | 'last_updated' | 'is_completed';
type SortOrder = 'asc' | 'desc';
type UpdateFilter = 'all' | 'unstarted' | 'neglected' | 'today';

export const StudentsList: React.FC<StudentsListProps> = ({ adminId, onSelectStudent }) => {
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [sortField, setSortField] = useState<SortField>('student_id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [updateFilter, setUpdateFilter] = useState<UpdateFilter>('all');
  const [stepFilter, setStepFilter] = useState('all');

  // Expanded student cards states
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  const [studentCards, setStudentCards] = useState<Record<string, CardsByStatus>>({});
  const [expandedLoading, setExpandedLoading] = useState<Record<string, boolean>>({});

  const toggleStudentExpand = async (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation(); // Prevent opening delegated kanban board
    
    const isCurrentlyExpanded = !!expandedStudents[studentId];
    setExpandedStudents(prev => ({ ...prev, [studentId]: !isCurrentlyExpanded }));
    
    if (!isCurrentlyExpanded && !studentCards[studentId]) {
      setExpandedLoading(prev => ({ ...prev, [studentId]: true }));
      try {
        const res = await client.api.cards.$get({
          query: { student_id: studentId }
        });
        if (res.ok) {
          const data = await res.json();
          setStudentCards(prev => ({ ...prev, [studentId]: data }));
        }
      } catch (err) {
        console.error('Failed to fetch student cards:', err);
      } finally {
        setExpandedLoading(prev => ({ ...prev, [studentId]: false }));
      }
    }
  };

  const getActiveCardsCount = (cardsGroup?: CardsByStatus) => {
    if (!cardsGroup) return 0;
    return (cardsGroup['選考中']?.length || 0) + (cardsGroup['内定']?.length || 0) + (cardsGroup['終了']?.length || 0);
  };

  const getUpdateStatus = (student: StudentStat) => {
    const totalCount = student.active_count + student.offer_count + student.closed_count;
    if (totalCount === 0) {
      return { type: 'unstarted', text: '未着手', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' };
    }
    if (!student.last_updated) {
      return { type: 'neglected', text: '更新なし', color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' };
    }
    
    const lastUpdated = new Date(student.last_updated.replace(' ', 'T'));
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastUpdated.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays > 7) {
      return { type: 'neglected', text: '7日以上未更新', color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' };
    }
    if (diffDays <= 1) {
      return { type: 'today', text: '本日更新', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' };
    }
    return null;
  };

  const fetchStudents = async () => {
    try {
      const res = await client.api.admin.students.$get({
        query: { admin_id: adminId },
      });
      if (res.ok) {
        const data = await res.json() as { students: AdminStudentSummary[] };
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [adminId]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleToggleComplete = async (e: React.MouseEvent, studentId: string, currentVal: number) => {
    e.stopPropagation(); // Stop row click
    const newVal = currentVal === 1 ? 0 : 1;
    try {
      const res = await client.api.admin.students[':id'].$patch({
        param: { id: studentId },
        query: { admin_id: adminId },
        json: { is_completed: newVal },
      });

      if (res.ok) {
        setStudents(prev =>
          prev.map(s => (s.student_id === studentId ? { ...s, is_completed: newVal } : s))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudent = async (e: React.MouseEvent, studentId: string, name: string) => {
    e.stopPropagation(); // Stop row click
    if (!confirm(`学生 ${name} (${studentId}) と関連するすべての就活データを完全に削除しますか？`)) {
      return;
    }

    try {
      const res = await client.api.admin.students[':id'].$delete({
        param: { id: studentId },
        query: { admin_id: adminId },
      });

      if (res.ok) {
        setStudents(prev => prev.filter(s => s.student_id !== studentId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportCsv = async (text: string) => {
    setLoading(true);
    try {
      const res = await client.api.admin.students.bulk.$post({
        query: { admin_id: adminId },
        json: { csv: text },
      });

      if (res.ok) {
        const data = await res.json();
        alert(`インポート完了: ${data.count}名の学生を登録/更新しました。`);
        setShowImportModal(false);
        fetchStudents();
      } else {
        alert('インポートに失敗しました。CSVのフォーマットを確認してください。');
      }
    } catch (err) {
      console.error(err);
      alert('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.student_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Step filter
    if (stepFilter !== 'all') {
      if (!s.active_steps) return false;
      const stepsLower = s.active_steps.toLowerCase();
      if (stepFilter === '説明会') {
        if (!stepsLower.includes('説明会')) return false;
      } else if (stepFilter === 'ES・履歴書') {
        if (!stepsLower.includes('es') && !stepsLower.includes('履歴書') && !stepsLower.includes('書類')) return false;
      } else if (stepFilter === '適性検査') {
        if (!stepsLower.includes('適性検査') && !stepsLower.includes('spi') && !stepsLower.includes('試験') && !stepsLower.includes('テスト')) return false;
      } else if (stepFilter === '1次面接') {
        if (!stepsLower.includes('1次') && !stepsLower.includes('一次')) return false;
      } else if (stepFilter === '2次面接') {
        if (!stepsLower.includes('2次') && !stepsLower.includes('二次')) return false;
      } else if (stepFilter === '最終面接') {
        if (!stepsLower.includes('最終') && !stepsLower.includes('3次') && !stepsLower.includes('三次')) return false;
      } else if (stepFilter === '面談') {
        if (!stepsLower.includes('面談')) return false;
      } else {
        if (!stepsLower.includes(stepFilter.toLowerCase())) return false;
      }
    }

    if (updateFilter === 'all') return true;
    const status = getUpdateStatus(s);
    if (updateFilter === 'unstarted') {
      return status?.type === 'unstarted';
    }
    if (updateFilter === 'neglected') {
      return status?.type === 'neglected';
    }
    if (updateFilter === 'today') {
      return status?.type === 'today';
    }
    return true;
  });

  // Sort students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'student_id') {
      comparison = a.student_id.localeCompare(b.student_id);
    } else if (sortField === 'student_name') {
      comparison = a.student_name.localeCompare(b.student_name);
    } else if (sortField === 'active_count') {
      comparison = a.active_count - b.active_count;
    } else if (sortField === 'offer_count') {
      comparison = a.offer_count - b.offer_count;
    } else if (sortField === 'total_count') {
      const totalA = a.active_count + a.offer_count + a.closed_count;
      const totalB = b.active_count + b.offer_count + b.closed_count;
      comparison = totalA - totalB;
    } else if (sortField === 'last_updated') {
      const dateA = a.last_updated ? new Date(a.last_updated).getTime() : 0;
      const dateB = b.last_updated ? new Date(b.last_updated).getTime() : 0;
      comparison = dateA - dateB;
    } else if (sortField === 'is_completed') {
      comparison = a.is_completed - b.is_completed;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return (
    <div>
      {/* Search & Actions Bar */}
      <div className="flex justify-between align-center mb-24 gap-16" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="学籍番号、氏名で検索"
              style={{ paddingLeft: '38px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value)}
            className="form-control"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              width: '180px',
              height: '36px',
              borderColor: 'var(--border-subtle)',
              borderRadius: 'var(--radius-base)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="all">すべての選考ステップ</option>
            <option value="説明会">説明会</option>
            <option value="ES・履歴書">ES・履歴書</option>
            <option value="適性検査">適性検査(SPI)</option>
            <option value="1次面接">1次面接</option>
            <option value="2次面接">2次面接</option>
            <option value="最終面接">最終面接</option>
            <option value="面談">面談</option>
          </select>
          
          <div style={{ display: 'inline-flex', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-base)', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setUpdateFilter('all')}
              style={{
                fontSize: '0.85rem',
                padding: '6px 12px',
                border: 'none',
                background: updateFilter === 'all' ? 'var(--bg-surface)' : 'transparent',
                color: updateFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: updateFilter === 'all' ? 600 : 400,
                borderRadius: 'calc(var(--radius-base) - 2px)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: updateFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              すべて ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setUpdateFilter('neglected')}
              style={{
                fontSize: '0.85rem',
                padding: '6px 12px',
                border: 'none',
                background: updateFilter === 'neglected' ? 'var(--bg-surface)' : 'transparent',
                color: updateFilter === 'neglected' ? '#DC2626' : 'var(--text-secondary)',
                fontWeight: updateFilter === 'neglected' ? 600 : 400,
                borderRadius: 'calc(var(--radius-base) - 2px)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: updateFilter === 'neglected' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              未更新 ({students.filter(s => getUpdateStatus(s)?.type === 'neglected').length})
            </button>
            <button
              type="button"
              onClick={() => setUpdateFilter('unstarted')}
              style={{
                fontSize: '0.85rem',
                padding: '6px 12px',
                border: 'none',
                background: updateFilter === 'unstarted' ? 'var(--bg-surface)' : 'transparent',
                color: updateFilter === 'unstarted' ? '#B45309' : 'var(--text-secondary)',
                fontWeight: updateFilter === 'unstarted' ? 600 : 400,
                borderRadius: 'calc(var(--radius-base) - 2px)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: updateFilter === 'unstarted' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              未着手 ({students.filter(s => getUpdateStatus(s)?.type === 'unstarted').length})
            </button>
            <button
              type="button"
              onClick={() => setUpdateFilter('today')}
              style={{
                fontSize: '0.85rem',
                padding: '6px 12px',
                border: 'none',
                background: updateFilter === 'today' ? 'var(--bg-surface)' : 'transparent',
                color: updateFilter === 'today' ? '#059669' : 'var(--text-secondary)',
                fontWeight: updateFilter === 'today' ? 600 : 400,
                borderRadius: 'calc(var(--radius-base) - 2px)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: updateFilter === 'today' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              本日更新 ({students.filter(s => getUpdateStatus(s)?.type === 'today').length})
            </button>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>
          <Upload size={16} /> CSV一括登録
        </button>
      </div>

      {/* Students Table */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th onClick={() => handleSort('student_id')}>
                学籍番号 <ArrowUpDown size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('student_name')}>
                氏名 <ArrowUpDown size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('active_count')}>
                選考中 <ArrowUpDown size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('offer_count')}>
                内定先 <ArrowUpDown size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('total_count')}>
                全企業数 <ArrowUpDown size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('last_updated')}>
                最終更新日時 <ArrowUpDown size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('is_completed')} style={{ textAlign: 'center' }}>
                就活完了 <ArrowUpDown size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </th>
              <th style={{ textAlign: 'center' }}>アクション</th>
            </tr>
          </thead>
          <tbody>
             {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  登録されている学生がいません。
                </td>
              </tr>
            ) : (
              sortedStudents.map((student) => {
                const totalCount = student.active_count + student.offer_count + student.closed_count;
                const isExpanded = !!expandedStudents[student.student_id];

                return (
                  <React.Fragment key={student.student_id}>
                    <tr
                      className="clickable"
                      onClick={() => onSelectStudent({ id: student.student_id, name: student.student_name })}
                    >
                      <td 
                        style={{ textAlign: 'center', padding: '8px' }} 
                        onClick={(e) => toggleStudentExpand(e, student.student_id)}
                      >
                        <button 
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'inline-flex', color: 'var(--text-secondary)' }}
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{student.student_id}</td>
                      <td style={{ fontWeight: 500 }}>{student.student_name}</td>
                      <td>
                        <span className="badge badge-teal">{student.active_count} 社</span>
                      </td>
                      <td>
                        <span className="badge badge-green">{student.offer_count} 社</span>
                      </td>
                      <td>
                        <span className="badge badge-gray">{totalCount} 社</span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{student.last_updated ? student.last_updated.replace('T', ' ').substring(0, 16) : '-'}</span>
                          {(() => {
                            const status = getUpdateStatus(student);
                            if (status) {
                              return (
                                <span style={{
                                  alignSelf: 'flex-start',
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: `1px solid ${status.border}`,
                                  color: status.color,
                                  backgroundColor: status.bg,
                                  fontWeight: 500,
                                  marginTop: '2px'
                                }}>
                                  {status.text}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={(e) => handleToggleComplete(e, student.student_id, student.is_completed)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'inline-flex', color: student.is_completed === 1 ? 'var(--accent-muted)' : 'var(--text-tertiary)' }}
                        >
                          {student.is_completed === 1 ? <CheckSquare size={20} /> : <Square size={20} />}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={(e) => handleDeleteStudent(e, student.student_id, student.student_name)}
                          style={{ padding: '6px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} style={{ padding: '16px 24px', backgroundColor: 'var(--bg-secondary)', borderTop: 'none' }} onClick={(e) => e.stopPropagation()}>
                          <ExpandedDetail
                            studentName={student.student_name}
                            studentId={student.student_id}
                            loading={!!expandedLoading[student.student_id]}
                            cardsData={studentCards[student.student_id]}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CSV Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSubmit={handleImportCsv}
        loading={loading}
      />
    </div>
  );
};
