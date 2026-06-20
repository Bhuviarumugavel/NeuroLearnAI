/**
 * SubjectsPage.jsx — Manage study subjects/courses.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

const COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ec4899','#06b6d4','#ef4444'];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', description: '', color: COLORS[0] });
  const [saving, setSaving]     = useState(false);

  const load = () => api.get('/api/subjects').then((r) => setSubjects(r.data.subjects || [])).finally(() => setLoading(false));
  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/subjects', form);
      setForm({ name: '', description: '', color: COLORS[0] });
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    await api.delete(`/api/subjects/${id}`);
    setSubjects((p) => p.filter((s) => (s._id || s.id) !== id));
  };

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">📚 Subjects</h1>
          <p className="page-subtitle">Organize your study materials by subject</p>
        </div>
        <button id="add-subject-btn" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '✕ Cancel' : '+ Add Subject'}
        </button>
      </div>

      {showForm && (
        <div className="card animate-slide-up" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>New Subject</h3>
          <form onSubmit={handleSubmit} id="subject-form" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Subject name *</label>
              <input className="form-input" placeholder="e.g. Machine Learning" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Brief description…" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: form.color === c ? `2px solid ${c}` : 'none', transition: 'all 0.2s' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" id="save-subject-btn" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                {saving ? 'Saving…' : 'Save Subject'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="grid-3">{[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />)}</div>
      ) : subjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h3>No subjects yet</h3>
          <p>Add your first subject to start organizing!</p>
          <button className="btn btn-primary mt-16" onClick={() => setShowForm(true)}>+ Add Subject</button>
        </div>
      ) : (
        <div className="grid-3">
          {subjects.map((s) => {
            const id = s._id || s.id;
            return (
              <div key={id} className="card" style={{ borderLeft: `4px solid ${s.color || 'var(--accent-primary)'}`, position: 'relative' }}>
                <button onClick={() => handleDelete(id)}
                  style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color || '#7c3aed'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: 10 }}>📖</div>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>{s.name}</h3>
                {s.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.description}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
