import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './StatusBar.css';

export default function StatusBar() {
  const { clientId, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="status-bar">
      <div className="status-bar__connection">
        <span className="status-dot" />
        Connected as <span className="mono">{clientId}</span>
      </div>
      <button className="status-bar__logout" onClick={handleLogout}>
        Log out
      </button>
    </header>
  );
}
