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

// Mock index data - in production, this would come from WebSocket/API
const MOCK_INDICES = [
  { symbol: 'NIFTY', name: 'NIFTY 50', value: 24631.50, change: 145.30, changePercent: 0.59 },
  { symbol: 'BANKNIFTY', name: 'BANK NIFTY', value: 53250.75, change: -234.50, changePercent: -0.44 },
  { symbol: 'FINNIFTY', name: 'FIN NIFTY', value: 23456.80, change: 89.20, changePercent: 0.38 },
  { symbol: 'SENSEX', name: 'SENSEX', value: 81347.90, change: 312.45, changePercent: 0.39 },
];

function IndexCard({ index }) {
  const isGain = index.change >= 0;
  return (
    <div className="index-card">
      <div className="index-card__header">
        <span className="index-card__name">{index.name}</span>
        <span className={`index-card__change ${isGain ? 'is-gain' : 'is-loss'}`}>
          {isGain ? '+' : ''}{index.changePercent.toFixed(2)}%
        </span>
      </div>
      <div className="index-card__body">
        <span className="index-card__value">{index.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span className={`index-card__delta ${isGain ? 'is-gain' : 'is-loss'}`}>
          {isGain ? '▲' : '▼'} {Math.abs(index.change).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen = true, isConnected = false, onToggle }) {
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
          {MOCK_INDICES.map((index) => (
            <IndexCard key={index.symbol} index={index} />
          ))}
        </div>
      </div>
    </aside>
  );
}
