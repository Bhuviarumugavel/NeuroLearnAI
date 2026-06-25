/**
 * StudyLibraryPage.jsx — Study Library Page.
 * Central repository for all notes, generated summaries, and study resources.
 * Triggers study timer automatically when viewing documents.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useData } from '../context/DataContext';
import { useStudyTimer } from '../context/StudyTimerContext';

export default function StudyLibraryPage() {
  const { subjects, notes, refreshNotes, refreshSummary } = useData();
  const { startSession, stopSession } = useStudyTimer();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');

  // Active view document modal
  const [viewNote, setViewNote] = useState(null);

  // Edit notes state
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editForm, setEditForm] = useState({ text: '', subject_tag: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState('');

  // Handle document view modal opening (activates background study timer!)
  const handleViewNote = (note) => {
    setViewNote(note);
    const matchedSub = subjects.find(s => s.name.toLowerCase() === note.subject.toLowerCase());
    if (matchedSub) {
      startSession(matchedSub._id || matchedSub.id, matchedSub.name);
    } else {
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
      await Promise.all([refreshNotes(), refreshSummary()]);
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
      text: note.original_text || note.generated_notes || '',
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
      await Promise.all([refreshNotes(), refreshSummary()]);
      
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

  // Filter notes by search query and subject selector
  const filteredNotes = notes.filter(note => {
    const matchesSubject = selectedSubjectFilter === 'All' || (note.subject && note.subject.toLowerCase() === selectedSubjectFilter.toLowerCase());
    const matchesSearch = 
      (note.subject && note.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (note.original_text && note.original_text.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (note.summary && note.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (note.generated_notes && note.generated_notes.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSubject && matchesSearch;
  });

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 className="page-title" style={{ fontSize: '1.4rem' }}>📚 Study Library</h1>
        <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>View compiled summaries, lecture slides, and study guides</p>
        
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', marginTop: '4px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '36px', fontSize: '0.8rem' }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>🔍</span>
        </div>
      </div>

      {/* Subject Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button 
          className={`btn btn-sm ${selectedSubjectFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSelectedSubjectFilter('All')}
          style={{ fontSize: '0.72rem', padding: '6px 12px' }}
        >
          All
        </button>
        {subjects.map(s => (
          <button 
            key={s._id || s.id}
            className={`btn btn-sm ${selectedSubjectFilter === s.name ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSelectedSubjectFilter(s.name)}
            style={{ fontSize: '0.72rem', padding: '6px 12px' }}
          >
            {s.name}
          </button>
        ))}
      </div>

      {error && <div className="auth-error text-xs mb-16">{error}</div>}

      {/* Resources grid */}
      {filteredNotes.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="empty-state-icon">📚</div>
          <h3 style={{ fontSize: '0.9rem' }}>No study materials found</h3>
          <p style={{ fontSize: '0.78rem' }}>Pasted and uploaded study guides will show up here once created.</p>
          <Link to="/summarizer" className="btn btn-primary btn-sm mt-8">Create Summaries</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredNotes.map((note) => {
            const id = note._id || note.id;
            const matchedSub = subjects.find(s => s.name.toLowerCase() === note.subject?.toLowerCase());
            const subColor = matchedSub?.color || 'var(--accent-primary)';
            
            return (
              <div 
                key={id} 
                className="card animate-fade-in" 
                style={{ 
                  padding: '14px', 
                  borderLeft: `4px solid ${subColor}`, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px' 
                }}
              >
                <div className="flex-between">
                  <span className="badge badge-purple" style={{ background: `${subColor}15`, color: subColor, border: `1px solid ${subColor}20`, fontSize: '0.65rem' }}>
                    {note.subject || 'General'}
                  </span>
                  <button 
                    onClick={() => handleDelete(id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    ✕
                  </button>
                </div>
                
                <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {note.original_text ? `${note.original_text.slice(0, 45)}...` : 'AI Structured Study Note'}
                </h3>
                
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {note.summary || note.generated_notes || 'View document notes...'}
                </p>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '4px' }}>
                  <button className="btn btn-outline btn-sm btn-full" onClick={() => handleViewNote(note)} style={{ padding: '6px', fontSize: '0.72rem' }}>
                    🔍 Read Note
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(note)} style={{ padding: '6px', fontSize: '0.72rem' }}>
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
        <div className="overlay" style={{ zIndex: 1100 }}>
          <div className="modal animate-slide-up" style={{ padding: '20px', maxWidth: '400px', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.98rem' }}>📖 Studying Note</h3>
              <button className="btn btn-ghost btn-sm" onClick={handleCloseView} style={{ fontSize: '0.9rem', padding: '4px' }}>✕</button>
            </div>
            
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{viewNote.subject}</span>
              </div>

              {/* Background timer notification */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', padding: '8px 10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#a7f3d0' }}>
                <span className="timer-pulse-dot" style={{ display: 'inline-block' }}></span>
                <span>Focus Timer Active: duration tracked automatically.</span>
              </div>

              {viewNote.summary && (
                <div style={{ padding: '10px', background: 'var(--bg-input)', borderLeft: '3px solid var(--accent-primary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: '4px' }}>AI Summary Points</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: '1.4', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {viewNote.summary}
                  </p>
                </div>
              )}

              {viewNote.generated_notes && (
                <div style={{ padding: '10px', background: 'var(--bg-input)', borderLeft: '3px solid var(--accent-light)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: '4px' }}>AI Generated Study Guide</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: '1.4', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {viewNote.generated_notes}
                  </p>
                </div>
              )}

              {viewNote.original_text && (
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Original Document Content</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {viewNote.original_text}
                  </p>
                </div>
              )}
            </div>
            
            <button className="btn btn-outline btn-full btn-sm mt-16" onClick={handleCloseView} style={{ padding: '8px', fontSize: '0.78rem' }}>Close Note</button>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {editingNoteId && (
        <div className="overlay" style={{ zIndex: 1100 }}>
          <div className="modal animate-slide-up" style={{ padding: '20px', maxWidth: '380px' }}>
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.98rem' }}>Edit Resource</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(null)} style={{ fontSize: '0.9rem', padding: '4px' }}>✕</button>
            </div>
            <form onSubmit={handleUpdateNote} className="flex-col" style={{ gap: '10px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Document Content *</label>
                <textarea 
                  className="form-input" 
                  rows={6} 
                  value={editForm.text}
                  onChange={(e) => setEditForm(f => ({ ...f, text: e.target.value }))}
                  required 
                  style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                />
              </div>
              <button type="submit" className={`btn btn-primary btn-full ${savingEdit ? 'btn-loading' : ''}`} disabled={savingEdit} style={{ fontSize: '0.8rem', padding: '10px' }}>
                {savingEdit ? 'Saving...' : 'Save & Re-Summarize'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
