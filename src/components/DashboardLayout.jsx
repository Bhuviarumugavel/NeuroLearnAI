import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const BOTTOM_NAV_ITEMS = [
  { path: '/dashboard',     label: 'Home',        icon: '🏠' },
  { path: '/summarizer',    label: 'Summarizer',  icon: '📝' },
  { path: '/quiz',          label: 'Quiz',        icon: '🧩' },
  { path: '/subjects',      label: 'Subjects',    icon: '⚙️' },
];

export default function DashboardLayout() {
  const location = useLocation();
  const { reminders } = useData();
  const { logout } = useAuth();

  const [activeToast, setActiveToast] = useState(null);
  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const [showSettings, setShowSettings] = useState(false);

  // Background reminder notification listener
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const fired = reminders.find(r => {
        const id = r._id || r.id;
        const date = new Date(r.remind_at);
        return date <= now && !notifiedIds.has(id);
      });

      if (fired) {
        const id = fired._id || fired.id;
        setNotifiedIds(prev => new Set([...prev, id]));
        setActiveToast(fired.message);
        setTimeout(() => setActiveToast(null), 4000);
      }
    };

    const interval = setInterval(checkReminders, 4000);
    return () => clearInterval(interval);
  }, [reminders, notifiedIds]);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="app-layout">
      {/* Mobile-style Container Mockup */}
      <div className="mobile-shell">
        
        {/* Dropdown Overlay Backdrop */}
        {showSettings && (
          <div 
            onClick={() => setShowSettings(false)}
            style={{ position: 'absolute', inset: 0, zIndex: 1999, background: 'rgba(0,0,0,0.2)' }}
          />
        )}

        {/* Top-Right Settings Dropdown Menu */}
        {showSettings && (
          <div 
            className="animate-slide-up"
            style={{
              position: 'absolute',
              top: '56px',
              right: '12px',
              width: '180px',
              background: 'rgba(22, 22, 42, 0.96)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              zIndex: 2000,
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <Link 
              to="/calendar" 
              onClick={() => setShowSettings(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
            >
              📅 Calendar
            </Link>
            <Link 
              to="/library" 
              onClick={() => setShowSettings(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
            >
              📚 Study Library
            </Link>
            <Link 
              to="/profile" 
              onClick={() => setShowSettings(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
            >
              👤 Profile Settings
            </Link>
            <Link 
              to="/notifications" 
              onClick={() => setShowSettings(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
            >
              🔔 Study Alerts
            </Link>
            <Link 
              to="/subjects" 
              onClick={() => setShowSettings(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
            >
              ⚙️ Subject Config
            </Link>
            
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
            
            <button 
              onClick={() => { setShowSettings(false); logout(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', color: 'var(--accent-red)', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
            >
              🚪 Sign Out
            </button>
          </div>
        )}
        
        {/* Animated Toast Alert overlay */}
        {activeToast && (
          <div 
            className="animate-slide-up"
            style={{
              position: 'absolute',
              top: '70px',
              left: '16px',
              right: '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.68rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Study Reminder</div>
              <div>{activeToast}</div>
            </div>
            <button onClick={() => setActiveToast(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
          </div>
        )}

        {/* Top Header */}
        <header className="app-header">
          <Link to="/dashboard" className="app-header-logo" style={{ textDecoration: 'none' }}>
            <span>🧠</span>
            <span>NeurolearnAI</span>
          </Link>
          
          <div className="app-header-actions">
            <button 
              onClick={() => setShowSettings(prev => !prev)} 
              className="header-action-btn" 
              title="Settings & Menu"
              id="menu-settings-btn"
              style={{ fontSize: '1.4rem' }}
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* Scrollable View Content */}
        <main className="mobile-body">
          <Outlet />
        </main>

        {/* Sticky Bottom Tab Bar */}
        <nav className="bottom-nav">
          {BOTTOM_NAV_ITEMS.map(({ path, label, icon }) => (
            <Link
              key={path}
              to={path}
              className={`bottom-nav-item ${isActive(path) ? 'active' : ''}`}
              id={`nav-${label.toLowerCase()}`}
            >
              <span className="bottom-nav-icon">{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
