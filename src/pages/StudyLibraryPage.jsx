/**
 * StudyLibraryPage.jsx — Study Library Page
 * Central repository for notes, AI-generated summaries, and study resources.
 * Triggers study timer automatically when viewing documents.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useStudyTimer } from '../context/StudyTimerContext';

export default function StudyLibraryPage() {
  const { startSession, stopSession } = useStudyTimer();

  const [notes, setNotes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Active view document modal
  const [viewNote, setViewNote] = useState(null);

  // Edit notes state
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editForm, setEditForm] = useState({ text: '', subject_tag: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState('');

  const loadLibrary = async () => {
    try {
      const [notesRes, subsRes] = await Promise.all([
        api.get('/api/notes'),
        api.get('/api/subjects')
      ]);
      setNotes(notesRes.data.notes || []);
      setSubjects(subsRes.data.subjects || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  // Handle document view modal opening (activates background study timer!)
  const handleViewNote = (note) => {
    setViewNote(note);
    // Find subject ID to link timer session
    const matchedSub = subjects.find(s => s.name.toLowerCase() === note.subject.toLowerCase());
    if (matchedSub) {
      startSession(matchedSub._id || matchedSub.id, matchedSub.name);
    } else {
      // fallback to custom session
      startSession('general-doc', note.subject);
    }
  };

  const handleCloseView = () => {
    setViewNote(null);
    stopSession(); // stops background timer
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this resource permanently?')) return;
    try {
      await api.delete(`/api/notes/${id}`);
      setNotes(prev => prev.filter(n => (n._id || n.id) !== id));
      if (viewNote && (viewNote._id || viewNote.id) === id) {
        handleCloseView();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (note) => {
    setEditingNoteId(note._id || note.id);
    setEditForm({
      text: note.original_text || '',
      subject_tag: note.subject || 'General'
    });
    setError('');
  };

  const handleUpdateNote = async (e) => {
    e.preventDefault();
    if (!editForm.text.trim()) return;

    setSavingEdit(true);
    setError('');
    try {
      await api.put(`/api/notes/${editingNoteId}`, {
        text: editForm.text,
        subject_tag: editForm.subject_tag
      });
      setEditingNoteId(null);
      await loadLibrary();
      
      // Update details view if modal is open
      if (viewNote && (viewNote._id || viewNote.id) === editingNoteId) {
        const updated = notes.find(n => (n._id || n.id) === editingNoteId);
        if (updated) setViewNote(updated);
      }
    } catch (err) {
      setError('Failed to update notes content.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Filtering lists
  const filteredNotes = notes.filter(note => {
    const matchesSubject = selectedSubjectFilter === 'All' || note.subject.toLowerCase() === selectedSubjectFilter.toLowerCase();
    
    const matchesSearch = 
      note.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.original_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.tags && note.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesSubject && matchesSearch;
  });

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">📚 Study Library</h1>
          <p className="page-subtitle">Your central knowledge base of summaries, lecture notes, and textbook digests</p>
        </div>
        
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.88rem' }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
        </div>
      </div>

      {/* Subject Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button 
          className={`btn btn-sm ${selectedSubjectFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSelectedSubjectFilter('All')}
        >
          All Categories
        </button>
        {subjects.map(s => (
          <button 
            key={s._id || s.id}
            className={`btn btn-sm ${selectedSubjectFilter === s.name ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSelectedSubjectFilter(s.name)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {error && <div className="auth-error mb-16">{error}</div>}

      {/* Resources catalog */}
      {loading ? (
        <div className="grid-3">
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-lg)' }}></div>)}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h3>No study materials found</h3>
          <p>Go to the AI Summarizer or Subject Settings to compile notes and summaries.</p>
          <Link to="/summarizer" className="btn btn-primary mt-16">Generate Summaries</Link>
        </div>
      ) : (
        <div className="grid-3">
          {filteredNotes.map((note) => {
            const id = note._id || note.id;
            return (
              <div key={id} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '200px' }}>
                <div className="flex-between mb-8">
                  <span className="badge badge-purple">{note.subject || 'General'}</span>
                  <button 
                    onClick={() => handleDelete(id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
                
                <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {note.original_text ? `${note.original_text.slice(0, 40)}...` : 'AI Study Guide'}
                </h3>
                
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', lineClamp: 3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>
                  {note.summary || note.generated_notes || 'View full document preview.'}
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '12px 0 16px' }}>
                  {note.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{tag}</span>
                  )) || <span className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Notes</span>}
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <button className="btn btn-outline btn-sm btn-full" onClick={() => handleViewNote(note)}>
                    🔍 Read & Study
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(note)}>
                    ✏️ Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer Modal: View Summary Details & Track Timer */}
      {viewNote && (
        <div className="overlay">
          <div className="modal animate-slide-up" style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📖 Studying Resource
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={handleCloseView} style={{ fontSize: '1rem', padding: '4px 8px' }}>✕</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="badge badge-purple">Category: {viewNote.subject}</span>
                {viewNote.tags?.map(t => <span key={t} className="badge badge-blue">{t}</span>)}
              </div>

              {/* Background timer notification */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#a7f3d0' }}>
                <span className="timer-pulse-dot" style={{ display: 'inline-block' }}></span>
                <span>Smart Timer Active: Background study duration is accumulating for <strong>{viewNote.subject}</strong></span>
              </div>

              {viewNote.summary && (
                <div style={{ padding: '16px', background: 'var(--bg-input)', borderLeft: '3px solid var(--accent-primary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: '6px' }}>AI Summary Points</div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {viewNote.summary}
                  </p>
                </div>
              )}

              {viewNote.original_text && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Original Document Content</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
                    {viewNote.original_text}
                  </p>
                </div>
              )}

              {viewNote.generated_notes && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: '6px' }}>AI Generated Study Guide</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
                    {viewNote.generated_notes}
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <button className="btn btn-outline btn-full btn-sm" onClick={handleCloseView}>Close Preview & Sync Timer</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {editingNoteId && (
        <div className="overlay">
          <div className="modal animate-slide-up">
            <div className="modal-header">
              <h3>Edit Document Resource</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(null)}>✕</button>
            </div>
            <form onSubmit={handleUpdateNote} className="flex-col">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-note-content">Document Text Content *</label>
                <textarea 
                  id="edit-note-content"
                  className="form-input" 
                  rows={8} 
                  value={editForm.text}
                  onChange={(e) => setEditForm(f => ({ ...f, text: e.target.value }))}
                  required 
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" id="save-edit-btn" className={`btn btn-primary btn-full ${savingEdit ? 'btn-loading' : ''}`} disabled={savingEdit}>
                  {savingEdit ? 'Saving Edit...' : 'Save & Re-Summarize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
