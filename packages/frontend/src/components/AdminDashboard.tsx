import React, { useState, useEffect } from 'react';
import client from '../lib/hc';
import { StudentsList } from './admin/StudentsList';
import { CompanyMatrix } from './admin/CompanyMatrix';
import { EmailSender } from './admin/EmailSender';
import { EmailSettings } from './admin/EmailSettings';
import { TemplatesEditor } from './admin/TemplatesEditor';
import { LogOut, Users, LayoutGrid, Mail } from 'lucide-react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';

interface AdminDashboardProps {
  adminId: string;
  onLogout: () => void;
}

interface StudentStat {
  student_id: string;
  student_name: string;
  parent_email: string | null;
  is_completed: number;
}

type MainTab = 'students' | 'matrix' | 'email_mgmt';
type EmailSubTab = 'send' | 'link' | 'templates';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminId, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [students, setStudents] = useState<StudentStat[]>([]);

  // Resolve active main tab based on URL path
  let activeTab: MainTab = 'students';
  if (location.pathname.startsWith('/admin/matrix')) {
    activeTab = 'matrix';
  } else if (location.pathname.startsWith('/admin/emails')) {
    activeTab = 'email_mgmt';
  }

  // Resolve active email subtab based on URL path
  let activeEmailSubTab: EmailSubTab = 'send';
  if (location.pathname.startsWith('/admin/emails/link')) {
    activeEmailSubTab = 'link';
  } else if (location.pathname.startsWith('/admin/emails/templates')) {
    activeEmailSubTab = 'templates';
  }

  const fetchStudents = async () => {
    try {
      const res = await client.api.admin.students.$get({
        query: { admin_id: adminId },
      });
      if (res.ok) {
        const data = await res.json() as any;
        setStudents(
          data.students.map((s: any) => ({
            student_id: s.student_id,
            student_name: s.student_name,
            parent_email: s.parent_email,
            is_completed: s.is_completed,
          }))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [adminId]);

  const handleSelectStudent = (student: { id: string; name: string }) => {
    navigate(`/admin/students/${student.id}`);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header>
        <h1>
          <span>Yojitsu</span>
          <span style={{ fontWeight: 300, color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            管理者ダッシュボード
          </span>
        </h1>
        <div className="header-actions">
          <button className="btn" onClick={onLogout}>
            <LogOut size={16} /> ログアウト
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container">
        {/* Navigation Tabs */}
        <div className="admin-tabs">
          <div
            className={`admin-tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => navigate('/admin/students')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Users size={16} />
            <span>学生一覧</span>
          </div>
          <div
            className={`admin-tab ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => navigate('/admin/matrix')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <LayoutGrid size={16} />
            <span>受験企業マトリクス</span>
          </div>
          <div
            className={`admin-tab ${activeTab === 'email_mgmt' ? 'active' : ''}`}
            onClick={() => navigate('/admin/emails/send')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Mail size={16} />
            <span>メール管理</span>
          </div>
        </div>

        {/* Email Subtabs Navigation */}
        {activeTab === 'email_mgmt' && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px'
          }}>
            <button
              className={`btn ${activeEmailSubTab === 'send' ? 'btn-primary' : ''}`}
              onClick={() => navigate('/admin/emails/send')}
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
            >
              注意メール送信
            </button>
            <button
              className={`btn ${activeEmailSubTab === 'link' ? 'btn-primary' : ''}`}
              onClick={() => navigate('/admin/emails/link')}
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
            >
              連絡先メール紐づけ
            </button>
            <button
              className={`btn ${activeEmailSubTab === 'templates' ? 'btn-primary' : ''}`}
              onClick={() => navigate('/admin/emails/templates')}
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
            >
              テンプレメール設定
            </button>
          </div>
        )}

        {/* Dynamic Tab Render */}
        <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
          <Routes>
            <Route path="students" element={<StudentsList adminId={adminId} onSelectStudent={handleSelectStudent} />} />
            <Route path="matrix" element={<CompanyMatrix adminId={adminId} onSelectStudent={handleSelectStudent} />} />
            <Route path="emails/send" element={<EmailSender adminId={adminId} studentsList={students} />} />
            <Route path="emails/link" element={<EmailSettings adminId={adminId} studentsList={students} onRefresh={fetchStudents} />} />
            <Route path="emails/templates" element={<TemplatesEditor adminId={adminId} />} />
            <Route path="emails" element={<Navigate to="send" replace />} />
            <Route path="*" element={<Navigate to="students" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};
