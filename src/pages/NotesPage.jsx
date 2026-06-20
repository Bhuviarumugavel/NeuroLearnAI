/**
 * NotesPage.jsx — View, create, and manage study notes.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

function NoteCard({ note, onDelete }) {
  return (
    <div className="card animate-fade-in" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{note.title || 'Untitled Note'}</h3>
        <button
          onClick={() => onDelete(note._id || note.id)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '2px 6px' }}
          title="Delete note"
        >✕</button>
      </div>
      {note.summary && (
        <div style={{ background: 'rgba(124,58,237,0.08)', borderLeft: '3px solid var(--accent-primary)', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-light)', fontWeight: 600, marginBottom: '4px' }}>AI SUMMARY</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{note.summary}</p>
        </div>
      )}
      <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {(note.original_text || '').slice(0, 200)}{(note.original_text || '').length > 200 ? '…' : ''}
      </p>
      <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        {new Date(note.created_at || Date.now()).toLocaleDateString()}
      </div>
    </div>
  );
}

export default function NotesPage() {
  const [notes, setNotes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title: '', text: '', subject_id: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const loadNotes = () => {
    api.get('/api/notes').then((r) => setNotes(r.data.notes || [])).finally(() => setLoading(false));
  };

  useEffect(loadNotes, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.text.trim()) { setError('Note content is required.'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/api/notes', { title: form.title, original_text: form.text });
      setForm({ title: '', text: '', subject_id: '' });
      setShowForm(false);
      loadNotes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save note.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    await api.delete(`/api/notes/${id}`);
    setNotes((prev) => prev.filter((n) => (n._id || n.id) !== id));
  };

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">📝 Notes</h1>
          <p className="page-subtitle">AI-powered notes with automatic summaries</p>
        </div>
        <button id="add-note-btn" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '✕ Cancel' : '+ New Note'}
        </button>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <div className="card animate-slide-up" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Create New Note</h3>
          {error && <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>}
          <form onSubmit={handleSubmit} className="flex-col" id="note-form">
            <div className="form-group">
              <label className="form-label">Title (optional)</label>
              <input className="form-input" placeholder="Note title…" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Content *</label>
              <textarea className="form-input" placeholder="Paste your notes here — AI will summarize them automatically…"
                rows={6} value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                style={{ resize: 'vertical' }} required />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" id="save-note-btn" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save & Summarize'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Notes Grid */}
      {loading ? (
        <div className="grid-3">
          {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>No notes yet</h3>
          <p>Create your first note and let AI summarize it for you!</p>
          <button className="btn btn-primary mt-16" onClick={() => setShowForm(true)}>+ Add First Note</button>
        </div>
      ) : (
        <div className="grid-3">
          {notes.map((note) => (
            <NoteCard key={note._id || note.id} note={note} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
