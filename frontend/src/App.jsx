import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ExamPage from './pages/ExamPage.jsx';
import Topbar from './components/Topbar.jsx';

function Protected({ children }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { isAuthed } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={isAuthed ? <Navigate to="/" replace /> : <SignupPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <div className="app-shell">
              <Topbar />
              <DashboardPage />
            </div>
          </Protected>
        }
      />
      <Route
        path="/exam/:id"
        element={
          <Protected>
            <div className="app-shell">
              <Topbar />
              <ExamPage />
            </div>
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
