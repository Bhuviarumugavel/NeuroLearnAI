/**
 * DashboardPage.jsx — Simplified Progress Dashboard.
 * Displays overall learning progress, daily target metrics, and subject completion stats.
 */
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

function StatCard({ icon, value, label, color }) {
  return (
    <div className="stat-card animate-fade-in" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="stat-icon" style={{ background: `${color}15`, fontSize: '1.2rem' }}>{icon}</div>
      <div className="stat-value" style={{ fontSize: '1.4rem' }}>{value}</div>
      <div className="stat-label" style={{ fontSize: '0.7rem' }}>{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { progressSummary, loading } = useData();

  const displayName = user?.full_name?.split(' ')[0] || 'Student';
  
  // Calculate daily goal progress
  const dailyGoal = user?.study_preferences?.daily_goal_minutes || 60;
  const currentStudyMinutes = progressSummary?.total_study_minutes || 0;
  const goalPercentage = Math.min(Math.round((currentStudyMinutes / dailyGoal) * 100), 100);

  return (
    <div className="page-container animate-slide-up">
      {/* Greet User Header */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem' }}>📈 Progress Dashboard</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>Welcome back, {displayName}! Track your academic stats</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid">
        <StatCard icon="🔥" value={user?.streak_days ?? 0} label="Day Streak" color="#f59e0b" />
        <StatCard 
          icon="⏱️" 
          value={progressSummary ? `${Math.round((progressSummary.total_study_minutes || 0) / 60)}h ${Math.round((progressSummary.total_study_minutes || 0) % 60)}m` : '0h 0m'} 
          label="Study Duration" 
          color="#7c3aed" 
        />
        <StatCard icon="📈" value={progressSummary ? `${progressSummary.overall_progress ?? 0}%` : '0%'} label="Overall Progress" color="#10b981" />
        <StatCard icon="📚" value={progressSummary?.total_subjects ?? 0} label="Subjects" color="#3b82f6" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Daily Study Progress Meter */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="section-title" style={{ fontSize: '0.95rem', alignSelf: 'flex-start', marginBottom: '8px' }}>⏱️ Daily Target</h3>
          
          <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
            <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="var(--bg-input)" strokeWidth="6" />
              <circle 
                cx="50" 
                cy="50" 
                r="42" 
                fill="transparent" 
                stroke="var(--accent-primary)" 
                strokeWidth="6" 
                strokeDasharray={2 * Math.PI * 42} 
                strokeDashoffset={2 * Math.PI * 42 * (1 - goalPercentage / 100)} 
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{goalPercentage}%</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Focus</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Focused for <strong>{currentStudyMinutes}</strong> of <strong>{dailyGoal}</strong> mins today
          </div>
        </div>

        {/* Subject Performance Table */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '12px' }}>📊 Subject Milestones</h3>

          {loading ? (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <span className="spinner" style={{ display: 'inline-block' }}></span>
            </div>
          ) : !progressSummary?.subjects || progressSummary.subjects.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <p style={{ fontSize: '0.8rem' }}>No subjects added yet. Configure them in Subject Settings (⚙️) above.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem' }}>Subject</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem' }}>Progress</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem' }}>Quiz</th>
                  </tr>
                </thead>
                <tbody>
                  {progressSummary.subjects.map((sub) => {
                    const completed = sub.completed || sub.progress >= 80;
                    const needsRetest = sub.needs_retest;
                    
                    return (
                      <tr key={sub.id}>
                        <td style={{ padding: '10px 12px', fontSize: '0.8rem', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sub.color || 'var(--accent-primary)', display: 'inline-block' }}></span>
                            {sub.name}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ flex: 1, width: '50px', height: '4px', background: 'var(--bg-input)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${sub.progress}%`, height: '100%', background: sub.color || 'var(--accent-primary)' }}></div>
                            </div>
                            <span>{sub.progress}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {completed ? (
                            <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>Passed</span>
                          ) : needsRetest ? (
                            <span className="badge badge-red" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>Failed</span>
                          ) : (
                            <span className="badge badge-purple" style={{ fontSize: '0.62rem', padding: '2px 6px', opacity: 0.8 }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
