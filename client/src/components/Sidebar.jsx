import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/app/home', label: 'Home', icon: '◧', enabled: true },
  { to: '/app/orders', label: 'Orders', icon: '↗', enabled: false },
  { to: '/app/positions', label: 'Positions', icon: '▤', enabled: false },
  { to: '/app/strategies', label: 'Strategies', icon: '◎', enabled: false },
  { to: '/app/settings', label: 'Settings', icon: '⚙', enabled: false },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">●</span>
        <span className="sidebar__brand-name">Trading Bot</span>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) =>
          item.enabled ? (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar__item ${isActive ? 'is-active' : ''}`}
            >
              <span className="sidebar__icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ) : (
            <div key={item.to} className="sidebar__item is-disabled" title="Coming soon">
              <span className="sidebar__icon">{item.icon}</span>
              {item.label}
              <span className="sidebar__soon">soon</span>
            </div>
          )
        )}
      </nav>

      <div className="sidebar__footer">
        <span>NSE · live during market hours</span>
      </div>
    </aside>
  );
}
