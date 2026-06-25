import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useData } from '../context/DataContext';

const BOTTOM_NAV_ITEMS = [
  { path: '/dashboard',     label: 'Progress',  icon: '🏠' },
  { path: '/summarizer',    label: 'Summarizer',icon: '📝' },
  { path: '/quiz',          label: 'Quiz',      icon: '🧩' },
  { path: '/calendar',      label: 'Calendar',  icon: '📅' },
  { path: '/library',       label: 'Library',   icon: '📚' },
];

export default function DashboardLayout() {
  const location = useLocation();
  const { reminders } = useData();

  const [activeToast, setActiveToast] = useState(null);
  const [notifiedIds, setNotifiedIds] = useState(new Set());

  // Background reminder notification listener
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      // Find a reminder where target time is past, and we haven't notified in this session yet
      const fired = reminders.find(r => {
        const id = r._id || r.id;
        const date = new Date(r.remind_at);
        return date <= now && !notifiedIds.has(id);
      });

      if (fired) {
        const id = fired._id || fired.id;
        setNotifiedIds(prev => new Set([...prev, id]));
        setActiveToast(fired.message);
        // Clear toast after 4 seconds
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
            <Link to="/subjects" className="header-action-btn" title="Subject Settings" id="nav-subject-settings">
              ⚙️
            </Link>
            <Link to="/notifications" className="header-action-btn" title="Notifications" id="nav-notifications">
              🔔
            </Link>
            <Link to="/profile" className="header-action-btn" title="Profile" id="nav-profile">
              👤
            </Link>
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
