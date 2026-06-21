/**
 * RemindersPage.jsx — Notification Settings Page
 * Manage automated study alerts (screen time, incomplete quizzes) and schedule custom study reminders.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ message: '', remind_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Automated notification settings (stored locally or mocked)
  const [automatedAlerts, setAutomatedAlerts] = useState({
    studyActivity: true,
    deadlines: true,
    screenTime: false,
    incompleteQuizzes: true,
    pendingRevisions: true,
  });

  const loadReminders = () => {
    api.get('/api/reminders')
      .then((r) => setReminders(r.data.reminders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleToggle = (key) => {
    setAutomatedAlerts(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.message.trim() || !form.remind_at) {
      setError('Please fill in both the reminder text and time.');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      // Corrected API endpoint route to /api/reminders/trigger
      await api.post('/api/reminders/trigger', {
        message: form.message,
        remind_at: new Date(form.remind_at).toISOString()
      });
      setForm({ message: '', remind_at: '' });
      setShowForm(false);
      loadReminders();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to schedule reminder.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/reminders/${id}`);
      setReminders((p) => p.filter((r) => (r._id || r.id) !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const isUpcoming = (dt) => new Date(dt) > new Date();

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">🔔 Notification Settings</h1>
          <p className="page-subtitle">Configure intelligent reminders, screen time warnings, and study session alerts</p>
        </div>
        <button 
          id="add-reminder-btn"
          className="btn btn-primary" 
          onClick={() => { setShowForm(!showForm); setError(''); }}
        >
          {showForm ? '✕ Cancel' : '+ Set Reminder'}
        </button>
      </div>

      {error && <div className="auth-error mb-16">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Automated Alerts Toggles */}
        <div className="card">
          <h2 className="section-title">⚙️ Automated Alerts & Reminders</h2>
          <p className="text-muted text-sm mb-24">Configure which notifications NeuroLearn AI should generate based on your study habits and schedules.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Toggle 1 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Study Activity Alerts</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Reminders to maintain your daily focus time streak</div>
              </div>
              <input type="checkbox" checked={automatedAlerts.studyActivity} onChange={() => handleToggle('studyActivity')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            </div>

            {/* Toggle 2 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Subject Deadline Reminders</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Alerts 7 days, 3 days and 1 day before configured exam dates</div>
              </div>
              <input type="checkbox" checked={automatedAlerts.deadlines} onChange={() => handleToggle('deadlines')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            </div>

            {/* Toggle 3 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Screen Time warnings</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Warnings if you study continuously for over 2 hours</div>
              </div>
              <input type="checkbox" checked={automatedAlerts.screenTime} onChange={() => handleToggle('screenTime')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            </div>

            {/* Toggle 4 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Incomplete Quiz Notifications</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Prompt to test your understanding when new notes are added</div>
              </div>
              <input type="checkbox" checked={automatedAlerts.incompleteQuizzes} onChange={() => handleToggle('incompleteQuizzes')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            </div>

            {/* Toggle 5 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Pending Revision Reminders</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Spaced repetition alerts for subjects flagged with "Retest Required"</div>
              </div>
              <input type="checkbox" checked={automatedAlerts.pendingRevisions} onChange={() => handleToggle('pendingRevisions')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            </div>
          </div>
        </div>

        {/* Right Column: Custom Reminders list & form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* New Custom Reminder Form */}
          {showForm && (
            <div className="card animate-slide-up">
              <h3 style={{ marginBottom: '16px' }}>Schedule Custom Reminder</h3>
              <form onSubmit={handleSubmit} id="reminder-form" className="flex-col">
                <div className="form-group">
                  <label className="form-label" htmlFor="custom-remind-time">Remind At *</label>
                  <input 
                    id="custom-remind-time"
                    className="form-input" 
                    type="datetime-local" 
                    value={form.remind_at}
                    onChange={(e) => setForm(f => ({ ...f, remind_at: e.target.value }))} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="custom-remind-message">Reminder Message *</label>
                  <input 
                    id="custom-remind-message"
                    className="form-input" 
                    placeholder="e.g. Study session on Physics chapters 3 & 4" 
                    value={form.message}
                    onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))} 
                    required 
                  />
                </div>
                <button type="submit" id="save-reminder-btn" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                  {saving ? 'Scheduling...' : '🔔 Set Study Alert'}
                </button>
              </form>
            </div>
          )}

          {/* Active study reminders feed */}
          <div className="card">
            <h3 className="section-title">📋 Scheduled Alerts Queue</h3>
            {loading ? (
              <span className="spinner" style={{ display: 'block', margin: '20px auto' }}></span>
            ) : reminders.length === 0 ? (
              <p className="text-muted text-sm" style={{ padding: '8px 0' }}>No custom reminders scheduled.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                {reminders.map((r) => {
                  const id = r._id || r.id;
                  const upcoming = isUpcoming(r.remind_at);
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '1.2rem' }}>{upcoming ? '🔔' : '✅'}</div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.message}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {new Date(r.remind_at).toLocaleString()}
                        </div>
                      </div>
                      <span className={`badge ${upcoming ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.68rem' }}>{upcoming ? 'Pending' : 'Fired'}</span>
                      <button 
                        onClick={() => handleDelete(id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
