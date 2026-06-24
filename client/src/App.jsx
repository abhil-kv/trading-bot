import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardLayout from './pages/DashboardLayout.jsx';
import HomePage from './pages/HomePage.jsx';

function FullScreenLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
        letterSpacing: '0.05em',
      }}
    >
      LOADING…
    </div>
  );
}

function RequireAuth({ children }) {
  const { authenticated, checking } = useAuth();
  if (checking) return <FullScreenLoader />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { authenticated, checking } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={checking ? <FullScreenLoader /> : authenticated ? <Navigate to="/app/home" replace /> : <LoginPage />}
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="home" element={<HomePage />} />
        <Route index element={<Navigate to="home" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={authenticated ? '/app/home' : '/login'} replace />} />
    </Routes>
  );
}
