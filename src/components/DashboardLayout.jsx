/**
 * DashboardLayout.jsx — Wraps all protected pages with sidebar.
 */
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 199,
          }}
        />
      )}

      <Sidebar onNavigate={() => setSidebarOpen(false)} />

      <div className="main-content">
        {/* Mobile header */}
        <div style={{
          display: 'none',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--bg-surface)',
        }} className="mobile-header">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            ☰
          </button>
          <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.1rem', background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            NeurolearnAI
          </span>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
