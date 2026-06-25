import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './StatusBar.css';

export default function StatusBar() {
  const { clientId, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isProfileOpen]);

  // Get initials from clientId for avatar
  const getInitials = (id) => {
    if (!id) return 'U';
    return id.substring(0, 2).toUpperCase();
  };

  return (
    <header className="status-bar">
      <div className="status-bar__connection">
        <span className="status-dot" />
        Connected as <span className="mono">{clientId}</span>
      </div>
      
      <div className="profile-container" ref={profileRef}>
        <button
          className="profile-avatar"
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          aria-label="User profile"
        >
          {getInitials(clientId)}
        </button>
        
        {isProfileOpen && (
          <div className="profile-dropdown">
            <div className="profile-dropdown__header">
              <div className="profile-dropdown__avatar">
                {getInitials(clientId)}
              </div>
              <div className="profile-dropdown__info">
                <div className="profile-dropdown__label">User Name</div>
                <div className="profile-dropdown__value">{clientId || 'Guest'}</div>
              </div>
            </div>
            
            <div className="profile-dropdown__divider" />
            
            <div className="profile-dropdown__section">
              <div className="profile-dropdown__item">
                <span className="profile-dropdown__label">Client ID</span>
                <span className="profile-dropdown__value mono">{clientId}</span>
              </div>
            </div>
            
            <div className="profile-dropdown__divider" />
            
            <button
              className="profile-dropdown__logout"
              onClick={handleLogout}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.6667 11.3333L14 8L10.6667 4.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
