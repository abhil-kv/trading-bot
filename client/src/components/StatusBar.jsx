import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './StatusBar.css';

export default function StatusBar({ onToggleSidebar, isSidebarOpen }) {
  const { clientId, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="status-bar">
      <div className="status-bar__left">
        <button
          className="status-bar__hamburger"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
        <div className="status-bar__connection">
          <span className="status-dot" />
          Connected as <span className="mono">{clientId}</span>
        </div>
      </div>
      <button className="status-bar__logout" onClick={handleLogout}>
        Log out
      </button>
    </header>
  );
}
