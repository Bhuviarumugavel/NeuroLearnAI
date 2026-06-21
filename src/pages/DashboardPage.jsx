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

  // New state variables for Study Schedule & Notes
  const [plans, setPlans] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [viewNote, setViewNote] = useState(null);

  const loadDashboardData = () => {
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

    // Fetch plans and notes
    Promise.all([
      api.get('/api/study-plans'),
      api.get('/api/notes')
    ]).then(([plansRes, notesRes]) => {
      setPlans(plansRes.data.plans || []);
      setNotes(notesRes.data.notes || []);
    }).catch(err => {
      console.error(err);
    }).finally(() => {
      setViewNote(null);
      setLoadingSchedule(false);
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleToggleTopic = async (planId, topicIdx, currentCompleted) => {
    try {
      // Optimistic update
      setPlans(prevPlans => prevPlans.map(plan => {
        if ((plan._id || plan.id) === planId) {
          const updatedTopics = [...plan.topics];
          updatedTopics[topicIdx] = {
            ...updatedTopics[topicIdx],
            completed: !currentCompleted
          };
          return { ...plan, topics: updatedTopics };
        }
        return plan;
      }));

      await api.put(`/api/study-plans/${planId}/progress`, {
        topic_index: topicIdx,
        completed: !currentCompleted
      });
      
      // Sync dashboard data
      loadDashboardData();
    } catch (err) {
      console.error("Failed to update topic progress", err);
    }
  };

  const getTopicDateStr = (planCreatedAt, topicDay) => {
    if (!planCreatedAt) return '';
    const start = new Date(planCreatedAt);
    start.setDate(start.getDate() + (topicDay - 1));
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  };

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
          
          {/* Today's Study Schedule & Related Notes */}
          <div className="card card-glow" style={{ borderLeft: '4px solid var(--accent-light)' }}>
            <h2 className="section-title">📋 Today's Study Schedule & Notes</h2>
            
            {loadingSchedule ? (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <span className="spinner" style={{ display: 'inline-block' }}></span>
              </div>
            ) : (() => {
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

              // Extract today's topics across all plans
              const todayTopics = [];
              plans.forEach(plan => {
                plan.topics?.forEach((topic, idx) => {
                  if (getTopicDateStr(plan.created_at, topic.day) === todayStr) {
                    todayTopics.push({
                      planId: plan._id || plan.id,
                      subjectName: plan.subject_name || plan.subject,
                      topicIndex: idx,
                      ...topic
                    });
                  }
                });
              });

              if (todayTopics.length === 0) {
                // Render fallback listing recent notes from Study Library
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px dashed var(--border-subtle)' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🏖️</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>No Scheduled Study Topics for Today!</div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>You're fully caught up. Use this time to revise your notes library below.</p>
                    </div>
                    {notes.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>📚 Recently Compiled Study Notes</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {notes.slice(0, 3).map((note) => {
                            const matchedSub = summary?.subjects?.find(s => s.name.toLowerCase() === note.subject?.toLowerCase());
                            const themeColor = matchedSub?.color || 'var(--accent-primary)';
                            return (
                              <div key={note._id || note.id} className="flex-between" style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', borderLeft: `3px solid ${themeColor}` }}>
                                <div style={{ overflow: 'hidden', marginRight: '16px' }}>
                                  <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                    {note.original_text ? `${note.original_text.slice(0, 45)}...` : 'AI Structured Study Note'}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Subject: <span style={{ color: themeColor, fontWeight: 600 }}>{note.subject}</span> • {note.type === 'auto_generated' ? '✨ AI Generated' : '📝 Manual'}
                                  </div>
                                </div>
                                <button className="btn btn-outline btn-xs" onClick={() => setViewNote(note)} style={{ padding: '4px 8px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                  🔍 Read Notes
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {todayTopics.map((topic, i) => {
                    // Get notes matching this topic's subject
                    const matchingNotes = notes.filter(n => n.subject?.toLowerCase() === topic.subjectName?.toLowerCase());
                    const matchedSub = summary?.subjects?.find(s => s.name.toLowerCase() === topic.subjectName?.toLowerCase());
                    const themeColor = matchedSub?.color || 'var(--accent-primary)';

                    return (
                      <div key={i} style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', borderLeft: `4px solid ${themeColor}` }}>
                        <div className="flex-between mb-8">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
                            <input 
                              type="checkbox" 
                              checked={topic.completed} 
                              onChange={() => handleToggleTopic(topic.planId, topic.topicIndex, topic.completed)}
                              style={{ width: '15px', height: '15px', accentColor: themeColor }}
                            />
                            <span style={{ textDecoration: topic.completed ? 'line-through' : 'none', color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                              {topic.name}
                            </span>
                          </label>
                          <span className="badge badge-purple" style={{ background: `${themeColor}15`, color: themeColor, border: `1px solid ${themeColor}30`, fontSize: '0.7rem' }}>
                            {topic.subjectName}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          ⏱️ Focus target: {topic.duration} minutes for today
                        </div>

                        {/* Associated Study Notes list */}
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>📚 Available Study Notes for {topic.subjectName}</div>
                          {matchingNotes.length === 0 ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>No notes generated for this subject yet.</span>
                              <Link to="/summarizer" className="auth-link text-xs">✨ Add Notes</Link>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {matchingNotes.map((note) => (
                                <div key={note._id || note.id} className="flex-between" style={{ background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                                    {note.type === 'auto_generated' ? '✨ ' : '📝 '} 
                                    {note.original_text ? `${note.original_text.slice(0, 35)}...` : 'AI Structured Study Note'}
                                  </span>
                                  <button className="btn btn-ghost btn-xs" onClick={() => setViewNote(note)} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                                    🔍 Read
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

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

      {/* Modal Drawer: View Note Details */}
      {viewNote && (
        <div className="overlay" style={{ zIndex: 1000 }}>
          <div className="modal animate-slide-up" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📖 Study Notes: {viewNote.subject}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewNote(null)} style={{ fontSize: '1rem', padding: '4px 8px' }}>✕</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="badge badge-purple">Category: {viewNote.subject}</span>
                <span className="badge badge-blue">{viewNote.type === 'auto_generated' ? '✨ AI Auto Notes' : '📝 Manual'}</span>
              </div>

              {viewNote.summary && (
                <div style={{ padding: '16px', background: 'var(--bg-input)', borderLeft: '3px solid var(--accent-primary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: '6px' }}>AI Summary Points</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {viewNote.summary}
                  </p>
                </div>
              )}

              {viewNote.original_text && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Original Document Content</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
                    {viewNote.original_text}
                  </p>
                </div>
              )}

              {viewNote.generated_notes && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: '6px' }}>AI Generated Study Guide</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
                    {viewNote.generated_notes}
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <button className="btn btn-outline btn-full btn-sm" onClick={() => setViewNote(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
