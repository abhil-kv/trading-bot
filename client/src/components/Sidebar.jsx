import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/app/home', label: 'Home', icon: '◧', enabled: true },
  { to: '/app/news', label: 'News', icon: '📰', enabled: true },
  { to: '/app/strategies', label: 'Strategies', icon: '◎', enabled: true },
  { to: '/app/orders', label: 'Orders', icon: '↗', enabled: false },
  { to: '/app/positions', label: 'Positions', icon: '▤', enabled: false },
  { to: '/app/settings', label: 'Settings', icon: '⚙', enabled: false },
];

const API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:4000/api'
);

function IndexCard({ index }) {
  const isVix   = index.symbol === 'INDIAVIX';
  const isGain  = (index.change ?? 0) >= 0;

  // VIX rising = fear up = use a neutral amber tint rather than green/red
  const changeClass = isVix
    ? (isGain ? 'is-vix-up' : 'is-vix-down')
    : (isGain ? 'is-gain'   : 'is-loss');

  return (
    <div className={`index-card ${isVix ? 'index-card--vix' : ''}`}>
      <div className="index-card__header">
        <span className="index-card__name">{isVix ? 'INDIA VIX' : index.symbol}</span>
        <span className={`index-card__change ${changeClass}`}>
          {isGain ? '+' : ''}{(index.changePercent ?? 0).toFixed(2)}%
        </span>
      </div>
      <div className="index-card__body">
        <span className="index-card__value">
          {index.value != null
            ? index.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '—'}
        </span>
        <span className={`index-card__delta ${changeClass}`}>
          {isGain ? '▲' : '▼'} {Math.abs(index.change ?? 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function useIndices(pollMs = 15000) {
  const [indices, setIndices] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchIndices() {
      try {
        const res = await fetch(`${API_BASE}/market/indices`, { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.indices)) {
          setIndices(json.indices);
        }
      } catch {
        // Network error — keep showing whatever we had before
      }
    }

    fetchIndices();
    timerRef.current = setInterval(fetchIndices, pollMs);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [pollMs]);

  return indices;
}

export default function Sidebar({ isOpen = true, isConnected = false, onToggle }) {
  const indices = useIndices(5000);

  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : 'is-closed'}`}>
      <div className="sidebar__brand">
        <span className={`sidebar__connection-status ${isConnected ? 'is-connected' : 'is-disconnected'}`}>●</span>
        {isOpen ? (
          <>
            <span className="sidebar__brand-name">Trading Bot</span>
            <button
              className="sidebar__toggle"
              onClick={onToggle}
              aria-label="Close sidebar"
            >
              <span className="sidebar__close-icon">✕</span>
            </button>
          </>
        ) : (
          <button
            className="sidebar__toggle sidebar__toggle--hamburger"
            onClick={onToggle}
            aria-label="Open sidebar"
          >
            <span className="sidebar__hamburger-icon">
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </span>
          </button>
        )}
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) =>
          item.enabled ? (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar__item ${isActive ? 'is-active' : ''}`}
              title={!isOpen ? item.label : ''}
            >
              <span className="sidebar__icon">{item.icon}</span>
              <span className="sidebar__label">{item.label}</span>
            </NavLink>
          ) : (
            <div key={item.to} className="sidebar__item is-disabled" title={!isOpen ? item.label : 'Coming soon'}>
              <span className="sidebar__icon">{item.icon}</span>
              <span className="sidebar__label">{item.label}</span>
              <span className="sidebar__soon">soon</span>
            </div>
          )
        )}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__indices">
          {indices.length > 0
            ? indices.map((index) => <IndexCard key={index.symbol} index={index} />)
            : null}
        </div>
      </div>
    </aside>
  );
}
