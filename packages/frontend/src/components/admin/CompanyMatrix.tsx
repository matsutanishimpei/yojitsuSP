import React, { useState, useEffect } from 'react';
import client from '../../lib/hc';
import { Eye } from 'lucide-react';
import type { AdminStudentSummary, CompanyMatrixItem } from '@my-app/shared';

interface StudentStat {
  student_id: string;
  student_name: string;
}

interface CompanyMatrixProps {
  adminId: string;
  onSelectStudent: (student: { id: string; name: string }) => void;
}

export const CompanyMatrix: React.FC<CompanyMatrixProps> = ({ adminId, onSelectStudent }) => {
  const [matrix, setMatrix] = useState<CompanyMatrixItem[]>([]);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [matrixRes, studentsRes] = await Promise.all([
          client.api.admin.matrix.$get({ query: { admin_id: adminId } }),
          client.api.admin.students.$get({ query: { admin_id: adminId } }),
        ]);

        if (matrixRes.ok && studentsRes.ok) {
          const matrixData = await matrixRes.json() as { matrix: CompanyMatrixItem[] };
          const studentsData = await studentsRes.json() as { students: AdminStudentSummary[] };
          setMatrix(matrixData.matrix || []);
          setStudents(
            studentsData.students.map((s) => ({
              student_id: s.student_id,
              student_name: s.student_name,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch matrix data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [adminId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>データを読み込み中...</div>;
  }

  // Get unique companies
  const companiesMap = new Map<string, string | null>(); // company_name -> hojin_number
  for (const item of matrix) {
    companiesMap.set(item.company_name, item.hojin_number);
  }
  const uniqueCompanies = Array.from(companiesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Build cell lookup map: student_id + "::" + company_name -> status
  const cellLookup = new Map<string, string>();
  for (const item of matrix) {
    cellLookup.set(`${item.student_id}::${item.company_name}`, item.status);
  }

  const renderStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    let className = '';
    let symbol = '';
    switch (status) {
      case '予定':
        className = 'status-yotei';
        symbol = '△';
        break;
      case '選考中':
        className = 'status-seikou';
        symbol = '○';
        break;
      case '内定':
        className = 'status-naitei';
        symbol = '◎';
        break;
      case '終了':
        className = 'status-shuryo';
        symbol = '×';
        break;
      default:
        return null;
    }
    return (
      <span className={`status-indicator ${className}`} title={status}>
        {symbol}
      </span>
    );
  };

  const handleCellClick = (studentId: string) => {
    setHighlightedStudentId(highlightedStudentId === studentId ? null : studentId);
  };

  return (
    <div>
      <div className="card mb-24" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>
          💡 学生名をクリックするとその列がハイライトされます。虫眼鏡アイコンで学生のカンバンボードを表示します。
        </p>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="status-indicator status-yotei" style={{ width: '20px', height: '20px', fontSize: '0.75rem', borderRadius: '4px' }}>△</span> 予定
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="status-indicator status-seikou" style={{ width: '20px', height: '20px', fontSize: '0.75rem', borderRadius: '4px' }}>○</span> 選考中
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="status-indicator status-naitei" style={{ width: '20px', height: '20px', fontSize: '0.75rem', borderRadius: '4px' }}>◎</span> 内定
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="status-indicator status-shuryo" style={{ width: '20px', height: '20px', fontSize: '0.75rem', borderRadius: '4px' }}>×</span> 終了
          </span>
        </div>
      </div>

      {uniqueCompanies.length === 0 || students.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          受験状況データがありません。学生がカードを登録するとここに表示されます。
        </div>
      ) : (
        <div className="admin-table-container" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="matrix-table">
            <thead>
              <tr>
                <th style={{ minWidth: '240px', textAlign: 'left', borderTop: '1px solid var(--border-subtle)' }}>企業名</th>
                {students.map((student) => (
                  <th
                    key={student.student_id}
                    className={`vertical-header ${highlightedStudentId === student.student_id ? 'matrix-column-highlighted' : ''}`}
                    onClick={() => handleCellClick(student.student_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      {student.student_name}
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: 'normal', marginTop: '4px' }}>
                        ({student.student_id.substring(4)})
                      </span>
                    </div>
                    <button
                      className="btn btn-icon"
                      title="ボードを見る"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStudent({ id: student.student_id, name: student.student_name });
                      }}
                      style={{
                        padding: '4px',
                        border: 'none',
                        background: 'var(--bg-secondary)',
                        position: 'absolute',
                        bottom: '6px',
                        left: '50%',
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <Eye size={12} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniqueCompanies.map(([companyName, hojinNumber]) => (
                <tr key={companyName}>
                  <td style={{ textAlign: 'left', fontWeight: 500, backgroundColor: 'var(--bg-surface)' }}>
                    <div>{companyName}</div>
                    {hojinNumber && (
                      <div className="text-tertiary" style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>
                        法人番号: {hojinNumber}
                      </div>
                    )}
                  </td>
                  {students.map((student) => {
                    const status = cellLookup.get(`${student.student_id}::${companyName}`);
                    const isHighlighted = highlightedStudentId === student.student_id;

                    return (
                      <td
                        key={student.student_id}
                        className={`matrix-cell-td ${isHighlighted ? 'matrix-column-highlighted' : ''}`}
                        onClick={() => handleCellClick(student.student_id)}
                        style={{ cursor: 'pointer', verticalAlign: 'middle' }}
                      >
                        {renderStatusBadge(status)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
