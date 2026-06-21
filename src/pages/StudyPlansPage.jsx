/**
 * StudyPlansPage.jsx — AI study plan creation and management.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function StudyPlansPage() {
  const [plans, setPlans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ subject: '', goal: '', duration_weeks: 4, hours_per_day: 2 });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = () => api.get('/api/study-plans').then((r) => setPlans(r.data.plans || [])).finally(() => setLoading(false));
  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.goal.trim()) { setError('Subject and goal are required.'); return; }
    setSaving(true); setError('');
    try {
      // Calculate deadline date (duration_weeks from now)
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + (form.duration_weeks * 7));
      const deadlineStr = deadlineDate.toISOString().split('T')[0];

      const payload = {
        subject_name: form.subject,
        description: form.goal,
        deadline: deadlineStr,
        daily_minutes: Math.round(form.hours_per_day * 60)
      };

      await api.post('/api/study-plans/generate', payload);
      setForm({ subject: '', goal: '', duration_weeks: 4, hours_per_day: 2 });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create plan.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this study plan?')) return;
    await api.delete(`/api/study-plans/${id}`);
    setPlans((p) => p.filter((pl) => (pl._id || pl.id) !== id));
  };

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">📅 Study Plans</h1>
          <p className="page-subtitle">AI-generated personalized study schedules</p>
        </div>
        <button id="create-plan-btn" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '✕ Cancel' : '+ Create Plan'}
        </button>
      </div>

      {showForm && (
        <div className="card animate-slide-up" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>✨ Generate AI Study Plan</h3>
          {error && <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>}
          <form onSubmit={handleSubmit} id="study-plan-form" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <input className="form-input" placeholder="e.g. Calculus" value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (weeks)</label>
                <input className="form-input" type="number" min={1} max={52} value={form.duration_weeks}
                  onChange={(e) => setForm((f) => ({ ...f, duration_weeks: +e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Learning goal *</label>
              <input className="form-input" placeholder="e.g. Prepare for final exam, Learn advanced topics…"
                value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Study hours per day: <strong style={{ color: 'var(--accent-light)' }}>{form.hours_per_day}h</strong></label>
              <input type="range" min={0.5} max={8} step={0.5} value={form.hours_per_day}
                onChange={(e) => setForm((f) => ({ ...f, hours_per_day: +e.target.value }))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" id="generate-plan-btn" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                {saving ? '🤖 AI is planning…' : '✨ Generate Plan'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2].map((i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <h3>No study plans yet</h3>
          <p>Let AI build a personalized schedule for you!</p>
          <button className="btn btn-primary mt-16" onClick={() => setShowForm(true)}>+ Create First Plan</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {plans.map((plan) => {
            const id = plan._id || plan.id;
            // Calculate weeks between created_at and deadline dynamically
            let durationWeeks = plan.duration_weeks;
            if (!durationWeeks && plan.deadline && plan.created_at) {
              const diffMs = new Date(plan.deadline) - new Date(plan.created_at);
              durationWeeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
            }
            durationWeeks = durationWeeks || 4;

            const hoursPerDay = plan.daily_minutes ? (plan.daily_minutes / 60).toFixed(1) : (plan.hours_per_day || 2);

            return (
              <div key={id} className="card" style={{ position: 'relative' }}>
                <button onClick={() => handleDelete(id)}
                  style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', paddingRight: '32px' }}>
                  <div style={{ fontSize: '1.8rem' }}>📅</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>{plan.subject_name || plan.subject}</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-purple">{durationWeeks} weeks</span>
                      <span className="badge badge-blue">{hoursPerDay}h/day</span>
                    </div>
                  </div>
                </div>
                {(plan.description || plan.goal) && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    <strong>Goal:</strong> {plan.description || plan.goal}
                  </p>
                )}
                {/* Render topics schedule list since the backend generates topics */}
                {plan.topics && plan.topics.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-input)', borderRadius: 8, padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Study Schedule Topics</div>
                    {plan.topics.map((t, idx) => (
                      <div key={idx} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: t.completed ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                        <span style={{ textDecoration: t.completed ? 'line-through' : 'none' }}>Day {t.day}: {t.name}</span>
                        <span>{t.duration} mins</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
