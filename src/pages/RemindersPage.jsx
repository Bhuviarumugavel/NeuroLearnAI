import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function RemindersPage() {
  const { reminders, refreshReminders, refreshSummary } = useData();
  const { user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ message: '', remind_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Default reminder scheduler time based on availability window (e.g. 5-9 -> 5:00)
  useEffect(() => {
    if (showForm && user?.study_preferences?.availability) {
      const avail = user.study_preferences.availability;
      let hour = 18; // default to 6 PM (Evening)
      if (avail === 'Morning') hour = 8;
      else if (avail === 'Afternoon') hour = 14;
      else if (avail === 'Evening') hour = 18;
      else if (avail === 'Night') hour = 22;
      else if (avail === 'Weekends') hour = 10;
      else {
        const match = avail.match(/\d+/);
        if (match) {
          hour = parseInt(match[0], 10);
        }
      }
      
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(hour).padStart(2, '0');
      const defaultDateTime = `${yyyy}-${mm}-${dd}T${hh}:00`;
      setForm(f => ({ ...f, remind_at: defaultDateTime }));
    }
  }, [showForm, user]);

  // Automated notification settings toggles
  const [automatedAlerts, setAutomatedAlerts] = useState({
    studyActivity: true,
    deadlines: true,
    screenTime: false,
    incompleteQuizzes: true,
    pendingRevisions: true,
  });

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
      await api.post('/api/reminders/trigger', {
        message: form.message,
        remind_at: new Date(form.remind_at).toISOString()
      });
      setForm({ message: '', remind_at: '' });
      setShowForm(false);
      
      // Update global context states
      await Promise.all([refreshReminders(), refreshSummary()]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to schedule reminder.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this study alert?')) return;
    try {
      await api.delete(`/api/reminders/${id}`);
      // Update global context states
      await Promise.all([refreshReminders(), refreshSummary()]);
    } catch (err) {
      console.error(err);
    }
  };

  const isUpcoming = (dt) => new Date(dt) > new Date();

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem' }}>🔔 Notifications</h1>
        </div>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={() => { setShowForm(!showForm); setError(''); }}
          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
        >
          {showForm ? '✕ Cancel' : '+ Set Alert'}
        </button>
      </div>

      {error && <div className="auth-error text-xs mb-16">{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* New Custom Reminder Form */}
        {showForm && (
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Schedule Study Alert</h3>
            <form onSubmit={handleSubmit} className="flex-col" style={{ gap: '10px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Remind At *</label>
                <input 
                  className="form-input" 
                  type="datetime-local" 
                  value={form.remind_at}
                  onChange={(e) => setForm(f => ({ ...f, remind_at: e.target.value }))} 
                  required 
                  style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Reminder Text / Message *</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. Chapter 3 chemistry test prep" 
                  value={form.message}
                  onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))} 
                  required 
                  style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                />
              </div>
              <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving} style={{ fontSize: '0.8rem', padding: '10px' }}>
                {saving ? 'Scheduling...' : '🔔 Set Alert'}
              </button>
            </form>
          </div>
        )}

        {/* Active study reminders feed */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '8px' }}>📋 Scheduled Alerts Queue</h3>
          {reminders.length === 0 ? (
            <p className="text-muted text-xs">No study alerts scheduled.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reminders.map((r) => {
                const id = r._id || r.id;
                const upcoming = isUpcoming(r.remind_at);
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1rem' }}>{upcoming ? '🔔' : '✅'}</div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.message}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(r.remind_at).toLocaleString()}
                      </div>
                    </div>
                    <span className={`badge ${upcoming ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.62rem', padding: '2px 6px' }}>{upcoming ? 'Pending' : 'Fired'}</span>
                    <button 
                      onClick={() => handleDelete(id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Automated Alerts Toggles */}
        <div className="card" style={{ padding: '16px' }}>
          <h2 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '8px' }}>⚙️ Smart Alert Settings</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Study Activity Alerts</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}> Streak warnings</div>
              </div>
              <input type="checkbox" checked={automatedAlerts.studyActivity} onChange={() => handleToggle('studyActivity')} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Subject Deadlines</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Alerts before exam targets</div>
              </div>
              <input type="checkbox" checked={automatedAlerts.deadlines} onChange={() => handleToggle('deadlines')} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Screen Time warning</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Focus break recommendation</div>
              </div>
              <input type="checkbox" checked={automatedAlerts.screenTime} onChange={() => handleToggle('screenTime')} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
