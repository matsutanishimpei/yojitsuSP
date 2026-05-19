import React, { useState } from 'react';
import client from '../../lib/hc';
import { Search, Save, Check, AlertCircle } from 'lucide-react';

interface StudentStat {
  student_id: string;
  student_name: string;
  parent_email: string | null;
  is_completed: number;
}

interface EmailSettingsProps {
  adminId: string;
  studentsList: StudentStat[];
  onRefresh: () => void;
}

export const EmailSettings: React.FC<EmailSettingsProps> = ({ adminId, studentsList, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [emails, setEmails] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of studentsList) {
      map[s.student_id] = s.parent_email || '';
    }
    return map;
  });

  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  const handleParentEmailChange = (studentId: string, value: string) => {
    setEmails(prev => ({ ...prev, [studentId]: value }));
  };

  const handleSaveEmail = async (studentId: string) => {
    const parentEmail = emails[studentId]?.trim();
    
    setSavingStatus(prev => ({ ...prev, [studentId]: 'saving' }));

    try {
      const res = await client.api.admin.students[':id'].$patch({
        param: { id: studentId },
        query: { admin_id: adminId },
        json: { parent_email: parentEmail || null },
      });

      if (res.ok) {
        setSavingStatus(prev => ({ ...prev, [studentId]: 'saved' }));
        onRefresh();
        setTimeout(() => {
          setSavingStatus(prev => ({ ...prev, [studentId]: 'idle' }));
        }, 2000);
      } else {
        setSavingStatus(prev => ({ ...prev, [studentId]: 'error' }));
      }
    } catch (err) {
      console.error(err);
      setSavingStatus(prev => ({ ...prev, [studentId]: 'error' }));
    }
  };

  const filteredStudents = studentsList.filter(s =>
    s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Search Header */}
      <div className="flex justify-between align-center mb-24">
        <div style={{ position: 'relative', width: '320px' }}>
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
      </div>

      {/* Email linkage table */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>学籍番号</th>
              <th>氏名</th>
              <th>本人連絡先</th>
              <th>保護者連絡先メールアドレス</th>
              <th style={{ width: '120px', textAlign: 'center' }}>保存</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  学生が見つかりません。
                </td>
              </tr>
            ) : (
              filteredStudents.map((s) => {
                const status = savingStatus[s.student_id] || 'idle';
                return (
                  <tr key={s.student_id}>
                    <td style={{ fontFamily: 'monospace' }}>{s.student_id}</td>
                    <td style={{ fontWeight: 500 }}>{s.student_name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {s.student_id}@jec.ac.jp
                    </td>
                    <td>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="user@example.invalid"
                        style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                        value={emails[s.student_id] || ''}
                        onChange={(e) => handleParentEmailChange(s.student_id, e.target.value)}
                        disabled={status === 'saving'}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn"
                        onClick={() => handleSaveEmail(s.student_id)}
                        disabled={status === 'saving' || emails[s.student_id] === (s.parent_email || '')}
                        style={{
                          padding: '6px 12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          minWidth: '78px',
                          justifyContent: 'center'
                        }}
                      >
                        {status === 'saving' && '...'}
                        {status === 'saved' && <Check size={16} style={{ color: 'var(--accent-muted)' }} />}
                        {status === 'error' && <AlertCircle size={16} style={{ color: '#991B1B' }} />}
                        {status === 'idle' && (
                          <>
                            <Save size={14} />
                            <span style={{ fontSize: '0.85rem' }}>保存</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
