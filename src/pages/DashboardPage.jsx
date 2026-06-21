/**
 * DashboardPage.jsx — Personalized learning dashboard.
 * Displays daily study progress, upcoming deadlines, subject performance, quiz status, and AI study tips.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function StatCard({ icon, value, label, color }) {
  return (
    <div className="stat-card animate-fade-in" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="stat-icon" style={{ background: `${color}15`, fontSize: '1.4rem' }}>{icon}</div>
      <div className="stat-value">{value ?? <span className="skeleton" style={{ display: 'inline-block', width: 48, height: 32 }} />}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '☀️ Good morning';
  if (h < 17) return '🌤️ Good afternoon';
  return '🌙 Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recommendations, setRecommendations] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingAi, setLoadingAi] = useState(true);

  useEffect(() => {
    // Fetch summary
    api.get('/api/dashboard/summary')
      .then((r) => setSummary(r.data))
      .catch(() => setSummary({}))
      .finally(() => setLoadingSummary(false));

    // Fetch AI recommendations
    api.get('/api/dashboard/recommendations')
      .then((r) => setRecommendations(r.data.recommendations))
      .catch(() => setRecommendations('Start by adding some subjects to get AI-driven learning tips.'))
      .finally(() => setLoadingAi(false));
  }, []);

  const displayName = user?.full_name?.split(' ')[0] || 'Student';
  
  // Calculate daily goal progress
  const dailyGoal = user?.study_preferences?.daily_goal_minutes || 60;
  const currentStudyMinutes = summary?.total_study_minutes || 0;
  const goalPercentage = Math.min(Math.round((currentStudyMinutes / dailyGoal) * 100), 100);

  // Filter out upcoming deadlines from subjects
  const subjectsWithDeadlines = summary?.subjects
    ?.filter(s => s.deadline)
    ?.map(s => ({
      ...s,
      dateObj: new Date(s.deadline)
    }))
    ?.sort((a, b) => a.dateObj - b.dateObj) || [];

  return (
    <div className="page-container animate-slide-up">
      {/* Greet User Header */}
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{getGreeting()}</div>
          <h1 className="page-title">{displayName}'s Learning Hub</h1>
          <p className="page-subtitle">Your personalized learning dashboard and workspace</p>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '8px 16px', fontSize: '0.88rem' }}>
          📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid">
        <StatCard icon="🔥" value={user?.streak_days ?? 0} label="Day Streak" color="#f59e0b" />
        <StatCard 
          icon="⏱️" 
          value={summary ? `${Math.round((summary.total_study_minutes || 0) / 60)}h ${Math.round((summary.total_study_minutes || 0) % 60)}m` : null} 
          label="Total Study Time" 
          color="#7c3aed" 
        />
        <StatCard icon="📈" value={summary ? `${summary.overall_progress ?? 0}%` : null} label="Overall Progress" color="#10b981" />
        <StatCard icon="📚" value={summary?.total_subjects ?? (loadingSummary ? null : 0)} label="Subjects Tracking" color="#3b82f6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Performance & AI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Subject Performance & Quiz Status Table */}
          <div className="card">
            <h2 className="section-title" style={{ justifyContent: 'space-between' }}>
              <span>📊 Subject Performance & Quizzes</span>
              <Link to="/subjects" className="auth-link text-sm">Manage Settings</Link>
            </h2>

            {loadingSummary ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <span className="spinner" style={{ display: 'inline-block' }}></span>
              </div>
            ) : !summary?.subjects || summary.subjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <h3>No subjects configured</h3>
                <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>Configure your courses and parameters in Subject Settings.</p>
                <Link to="/subjects" className="btn btn-primary btn-sm">Configure Subjects</Link>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Learning Progress</th>
                      <th>Quiz Status</th>
                      <th>Daily Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.subjects.map((sub) => {
                      // Fetch actual database attributes or computed states
                      const completed = sub.completed || sub.progress >= 80;
                      const needsRetest = sub.needs_retest;
                      
                      return (
                        <tr key={sub.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: sub.color || 'var(--accent-primary)', display: 'inline-block' }}></span>
                              {sub.name}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ flex: 1, height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${sub.progress}%`, height: '100%', background: sub.color || 'var(--accent-primary)' }}></div>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: '32px', textAlign: 'right' }}>
                                {sub.progress}%
                              </span>
                            </div>
                          </td>
                          <td>
                            {completed ? (
                              <span className="badge badge-green">Completed</span>
                            ) : needsRetest ? (
                              <span className="badge badge-red">Retest Required</span>
                            ) : (
                              <span className="badge badge-purple" style={{ opacity: 0.8 }}>Pending Attempt</span>
                            )}
                          </td>
                          <td>
                            <span className="text-muted text-sm">{sub.daily_minutes || 45} mins</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Personalized AI Recommendations */}
          <div className="card card-glow" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
            <h3 className="section-title">💡 Personalized AI Study Recommendation</h3>
            {loadingAi ? (
              <div className="skeleton" style={{ height: '80px', width: '100%' }}></div>
            ) : (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {recommendations}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Daily Goals, Deadlines & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Daily Study Progress Meter */}
          <div className="card">
            <h3 className="section-title">⏱️ Daily Study Progress</h3>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '16px 0' }}>
              
              {/* Progress ring display */}
              <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="50" fill="transparent" stroke="var(--bg-input)" strokeWidth="8" />
                  <circle 
                    cx="60" 
                    cy="60" 
                    r="50" 
                    fill="transparent" 
                    stroke="var(--accent-primary)" 
                    strokeWidth="8" 
                    strokeDasharray={2 * Math.PI * 50} 
                    strokeDashoffset={2 * Math.PI * 50 * (1 - goalPercentage / 100)} 
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{goalPercentage}%</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Complete</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Studied <strong style={{ color: 'var(--text-primary)' }}>{currentStudyMinutes}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{dailyGoal}</strong> mins
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Set your focus goals in your profile.
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Deadlines & Exams */}
          <div className="card">
            <h3 className="section-title">📅 Upcoming Exams & Deadlines</h3>
            {subjectsWithDeadlines.length === 0 ? (
              <p className="text-muted text-sm" style={{ padding: '8px 0' }}>No upcoming exams or deadlines configured.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                {subjectsWithDeadlines.slice(0, 4).map((sub) => {
                  const daysLeft = Math.ceil((sub.dateObj - new Date()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysLeft < 0;
                  
                  return (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sub.color || 'var(--accent-primary)' }}></span>
                          {sub.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Due: {sub.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      
                      {isOverdue ? (
                        <span className="badge badge-red" style={{ fontSize: '0.68rem' }}>Overdue</span>
                      ) : daysLeft === 0 ? (
                        <span className="badge badge-red" style={{ fontSize: '0.68rem' }}>Today</span>
                      ) : daysLeft <= 3 ? (
                        <span className="badge badge-red" style={{ fontSize: '0.68rem' }}>{daysLeft}d left</span>
                      ) : (
                        <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{daysLeft}d left</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Workspaces Links */}
          <div className="card">
            <h3 className="section-title">⚡ Quick Workspaces</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <Link to="/summarizer" className="btn btn-outline btn-full btn-sm" style={{ justifyContent: 'flex-start' }}>📝 AI Summarizer</Link>
              <Link to="/quiz" className="btn btn-outline btn-full btn-sm" style={{ justifyContent: 'flex-start' }}>🧩 Quiz Center</Link>
              <Link to="/calendar" className="btn btn-outline btn-full btn-sm" style={{ justifyContent: 'flex-start' }}>📅 Calendar</Link>
              <Link to="/library" className="btn btn-outline btn-full btn-sm" style={{ justifyContent: 'flex-start' }}>📚 Study Library</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
