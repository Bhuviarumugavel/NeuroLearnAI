/**
 * DashboardPage.jsx — Main overview with stats, quick actions, and recent activity.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function StatCard({ icon, value, label, color }) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="stat-icon" style={{ background: `${color}1a`, fontSize: '1.4rem' }}>{icon}</div>
      <div className="stat-value">{value ?? <span className="skeleton" style={{ display: 'inline-block', width: 48, height: 32 }} />}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function QuickAction({ to, icon, title, desc, color }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer', borderLeft: `3px solid ${color}` }}>
        <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{icon}</div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{desc}</div>
      </div>
    </Link>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '☀️ Good morning';
  if (h < 17) return '🌤️ Good afternoon';
  return '🌙 Good evening';
}

function getInitials(name, email) {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (email || 'U')[0].toUpperCase();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard/summary')
      .then((r) => setStats(r.data))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, []);

  const displayName = user?.full_name?.split(' ')[0] || 'Student';

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{getGreeting()}</div>
          <h1 className="page-title">{displayName}'s Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Profile avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="profile" className="avatar avatar-lg" />
          ) : (
            <div className="avatar avatar-lg">{getInitials(user?.full_name, user?.email)}</div>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.full_name || 'Student'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard icon="🔥" value={user?.streak_days ?? 0} label="Day Streak" color="#f59e0b" />
        <StatCard icon="⏱️" value={`${Math.round((user?.total_study_minutes ?? 0) / 60)}h`} label="Study Hours" color="#7c3aed" />
        <StatCard icon="📚" value={stats?.total_subjects ?? (loading ? null : 0)} label="Subjects" color="#3b82f6" />
        <StatCard icon="📝" value={stats?.total_notes ?? (loading ? null : 0)} label="Notes" color="#10b981" />
        <StatCard icon="🧩" value={stats?.total_quizzes ?? (loading ? null : 0)} label="Quizzes Taken" color="#06b6d4" />
        <StatCard icon="📅" value={stats?.active_plans ?? (loading ? null : 0)} label="Study Plans" color="#ec4899" />
      </div>

      {/* Quick Actions */}
      <h2 className="section-title" style={{ marginBottom: '16px' }}>
        <span>⚡</span> Quick Actions
      </h2>
      <div className="grid-3" style={{ marginBottom: '32px' }}>
        <QuickAction to="/notes" icon="📝" title="Add Note" desc="Capture and AI-summarize a new note" color="var(--accent-green)" />
        <QuickAction to="/quiz" icon="🧩" title="Start Quiz" desc="Test yourself with AI-generated questions" color="var(--accent-cyan)" />
        <QuickAction to="/study-plans" icon="📅" title="Create Plan" desc="Build a personalized study schedule" color="var(--accent-primary)" />
        <QuickAction to="/subjects" icon="📚" title="Add Subject" desc="Track a new course or topic" color="var(--accent-blue)" />
        <QuickAction to="/reminders" icon="🔔" title="Set Reminder" desc="Never miss a study session" color="var(--accent-orange)" />
        <QuickAction to="/automation" icon="🤖" title="Run Automation" desc="Trigger UiPath study bots" color="#ec4899" />
      </div>

      {/* Study tip */}
      <div className="card card-glow" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ fontSize: '2rem', flexShrink: 0 }}>💡</div>
        <div>
          <h3 style={{ marginBottom: '6px', fontSize: '1rem' }}>AI Study Tip of the Day</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Use the <strong style={{ color: 'var(--accent-light)' }}>spaced repetition</strong> technique — review material at increasing intervals (1, 3, 7, 14 days) to maximize long-term retention. Head to <Link to="/quiz" style={{ color: 'var(--accent-light)' }}>Quiz</Link> to practice today!
          </p>
        </div>
      </div>
    </div>
  );
}
