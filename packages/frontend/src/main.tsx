import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { LoginView } from './components/LoginView';
import { KanbanView } from './components/KanbanView';
import { AdminDashboard } from './components/AdminDashboard';
import client from './lib/hc';
import './index.css';

interface UserSession {
  role: 'student' | 'admin';
  id: string;
  name: string;
}

const DelegatedKanbanWrapper = ({
  adminId,
  onLogout
}: {
  adminId: string;
  onLogout: () => void;
}) => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudent = async () => {
      try {
        const res = await client.api.admin.students.$get({
          query: { admin_id: adminId },
        });
        if (res.ok) {
          const data = await res.json() as any;
          const found = data.students?.find((s: any) => s.student_id === studentId);
          if (found) {
            setStudentName(found.student_name);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadStudent();
  }, [adminId, studentId]);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-primary)'
      }}>
        読み込み中...
      </div>
    );
  }

  if (!studentName) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>学生が見つかりません。</p>
        <button className="btn" onClick={() => navigate('/admin/students')}>
          管理者画面へ戻る
        </button>
      </div>
    );
  }

  return (
    <KanbanView
      studentId={studentId!}
      studentName={studentName}
      isReadOnly={true}
      onBackToAdmin={() => navigate('/admin/students')}
      onLogout={onLogout}
    />
  );
};

const AppRoutes = ({
  user,
  onLoginSuccess,
  onLogout
}: {
  user: UserSession | null;
  onLoginSuccess: (userData: UserSession) => void;
  onLogout: () => void;
}) => {
  return (
    <Routes>
      {/* Login Route */}
      <Route
        path="/login"
        element={
          user ? (
            user.role === 'admin' ? (
              <Navigate to="/admin/students" replace />
            ) : (
              <Navigate to="/kanban" replace />
            )
          ) : (
            <LoginView onLoginSuccess={onLoginSuccess} />
          )
        }
      />

      {/* Student Route */}
      <Route
        path="/kanban"
        element={
          user && user.role === 'student' ? (
            <KanbanView
              studentId={user.id}
              studentName={user.name}
              isReadOnly={false}
              onLogout={onLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin/*"
        element={
          user && user.role === 'admin' ? (
            <Routes>
              <Route
                path="students/:studentId"
                element={<DelegatedKanbanWrapper adminId={user.id} onLogout={onLogout} />}
              />
              <Route
                path="*"
                element={<AdminDashboard adminId={user.id} onLogout={onLogout} />}
              />
            </Routes>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Root Path Fallback */}
      <Route
        path="/"
        element={
          user ? (
            user.role === 'admin' ? (
              <Navigate to="/admin/students" replace />
            ) : (
              <Navigate to="/kanban" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('yojitsu_session');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse session:', e);
    } finally {
      setInitializing(false);
    }
  }, []);

  const handleLoginSuccess = (userData: UserSession) => {
    setUser(userData);
    localStorage.setItem('yojitsu_session', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('yojitsu_session');
  };

  if (initializing) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-primary)'
      }}>
        初期化中...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes user={user} onLoginSuccess={handleLoginSuccess} onLogout={handleLogout} />
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
