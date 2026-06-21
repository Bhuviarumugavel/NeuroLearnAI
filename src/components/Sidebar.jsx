/**
 * Sidebar.jsx — App navigation sidebar with user profile chip.
 */
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/dashboard',     label: 'Home',                  icon: '🏠' },
  { path: '/summarizer',    label: 'AI Summarizer',          icon: '📝' },
  { path: '/quiz',          label: 'Quiz Center',           icon: '🧩' },
  { path: '/calendar',      label: 'Calendar',              icon: '📅' },
  { path: '/subjects',      label: 'Subject Settings',      icon: '⚙️' },
  { path: '/library',       label: 'Study Library',          icon: '📚' },
  { path: '/notifications', label: 'Notification Settings', icon: '🔔' },
  { path: '/profile',       label: 'Profile',               icon: '👤' },
];

const AUTOMATION_ITEMS = [
  { path: '/automation',   label: 'UiPath Bots',  icon: '🤖' },
];

function getInitials(name, email) {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (email || 'U')[0].toUpperCase();
}

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const location          = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🧠</div>
        <span className="sidebar-logo-text">NeurolearnAI</span>
      </div>

      {/* Main Nav */}
      <div className="nav-section-label">Main</div>
      {NAV_ITEMS.map(({ path, label, icon }) => (
        <Link
          key={path}
          to={path}
          className={`nav-item ${isActive(path) ? 'active' : ''}`}
          onClick={onNavigate}
          id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
        >
          <span style={{ fontSize: '1.1rem' }}>{icon}</span>
          {label}
        </Link>
      ))}

      {/* Automation */}
      <div className="nav-section-label">Automation</div>
      {AUTOMATION_ITEMS.map(({ path, label, icon }) => (
        <Link
          key={path}
          to={path}
          className={`nav-item ${isActive(path) ? 'active' : ''}`}
          onClick={onNavigate}
          id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
        >
          <span style={{ fontSize: '1.1rem' }}>{icon}</span>
          {label}
        </Link>
      ))}

      {/* User footer */}
      <div className="sidebar-footer">
        <Link to="/profile" className="user-chip" style={{ textDecoration: 'none', cursor: 'pointer' }} onClick={onNavigate}>
          <div className="avatar">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="avatar" className="avatar" style={{ width: 36, height: 36 }} />
              : getInitials(user?.full_name, user?.email)
            }
          </div>
          <div className="user-info">
            <div className="user-name">{user?.full_name || 'Student'}</div>
            <div className="user-email">{user?.email}</div>
          </div>
        </Link>
        <button
          id="sidebar-logout"
          className="btn btn-ghost btn-sm btn-full"
          onClick={logout}
          style={{ justifyContent: 'flex-start', gap: '8px', color: 'var(--accent-red)' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </nav>
  );
}
