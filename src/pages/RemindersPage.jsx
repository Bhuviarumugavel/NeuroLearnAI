/**
 * RemindersPage.jsx — Study reminders management.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ title: '', message: '', remind_at: '', recurrence: 'none' });
  const [saving, setSaving]       = useState(false);

  const load = () => api.get('/api/reminders').then((r) => setReminders(r.data.reminders || [])).finally(() => setLoading(false));
  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.remind_at) return;
    setSaving(true);
    try {
      await api.post('/api/reminders', form);
      setForm({ title: '', message: '', remind_at: '', recurrence: 'none' });
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await api.delete(`/api/reminders/${id}`);
    setReminders((p) => p.filter((r) => (r._id || r.id) !== id));
  };

  const isUpcoming = (dt) => new Date(dt) > new Date();

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">🔔 Reminders</h1>
          <p className="page-subtitle">Stay on schedule with study alerts</p>
        </div>
        <button id="add-reminder-btn" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '✕ Cancel' : '+ Add Reminder'}
        </button>
      </div>

      {showForm && (
        <div className="card animate-slide-up" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>New Reminder</h3>
          <form onSubmit={handleSubmit} id="reminder-form" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="Study Session" value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date & Time *</label>
                <input className="form-input" type="datetime-local" value={form.remind_at}
                  onChange={(e) => setForm((f) => ({ ...f, remind_at: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <input className="form-input" placeholder="Reminder message…" value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Recurrence</label>
              <select className="form-input" value={form.recurrence}
                onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}>
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" id="save-reminder-btn" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                {saving ? 'Saving…' : '🔔 Set Reminder'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}
        </div>
      ) : reminders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <h3>No reminders set</h3>
          <p>Add a reminder to stay on top of your study schedule!</p>
          <button className="btn btn-primary mt-16" onClick={() => setShowForm(true)}>+ Add Reminder</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reminders.map((r) => {
            const id = r._id || r.id;
            const upcoming = isUpcoming(r.remind_at);
            return (
              <div key={id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px' }}>
                <div style={{ fontSize: '1.4rem' }}>{upcoming ? '🔔' : '✅'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>{r.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(r.remind_at).toLocaleString()} {r.recurrence !== 'none' && `· ${r.recurrence}`}
                  </div>
                  {r.message && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{r.message}</div>}
                </div>
                <span className={`badge ${upcoming ? 'badge-blue' : 'badge-green'}`}>{upcoming ? 'Upcoming' : 'Past'}</span>
                <button onClick={() => handleDelete(id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
