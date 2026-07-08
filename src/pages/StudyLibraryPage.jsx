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
  const [selectedFolder, setSelectedFolder] = useState('All');

  // Active view document modal
  const [viewNote, setViewNote] = useState(null);

  // Edit notes state
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editForm, setEditForm] = useState({ text: '', subject_tag: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState('');

  const getNoteFolder = (note) => {
    const source = note.upload_source || '';
    const type = note.type || '';
    const fileType = (note.file_type || '').toLowerCase();
    const fileName = (note.file_name || '').toLowerCase();
    
    if (source === 'subject_settings') return 'Subjects';
    if (type === 'auto_generated') return 'AI Summaries';
    
    if (fileType === 'pdf' || fileName.endsWith('.pdf')) return 'PDFs';
    if (fileType === 'docx' || fileType === 'doc' || fileName.endsWith('.docx') || fileName.endsWith('.doc')) return 'DOCX';
    if (fileType === 'ppt' || fileType === 'pptx' || fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) return 'PPT';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileType) || /\.(png|jpe?g|webp|gif)$/i.test(fileName)) return 'Images';
    
    if (source === 'manual_summarizer' || type === 'manual') return 'Manual Summaries';
    
    return 'Other Files';
  };

  const getFolderIcon = (folder) => {
    switch (folder) {
      case 'All': return '📂';
      case 'Subjects': return '📁';
      case 'AI Summaries': return '🤖';
      case 'Manual Summaries': return '✍️';
      case 'PDFs': return '📄';
      case 'DOCX': return '📝';
      case 'PPT': return '📊';
      case 'Images': return '🖼️';
      default: return '📁';
    }
  };

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

  // Filter notes by search query, subject, and folder selection
  const filteredNotes = notes.filter(note => {
    const matchesSubject = selectedSubjectFilter === 'All' || (note.subject && note.subject.toLowerCase() === selectedSubjectFilter.toLowerCase());
    const matchesFolder = selectedFolder === 'All' || getNoteFolder(note) === selectedFolder;
    
    const matchesSearch = 
      (note.file_name && note.file_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (note.subject && note.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (note.original_text && note.original_text.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (note.summary && note.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (note.generated_notes && note.generated_notes.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSubject && matchesFolder && matchesSearch;
  });

  const foldersList = ['All', 'Subjects', 'AI Summaries', 'Manual Summaries', 'PDFs', 'DOCX', 'PPT', 'Images', 'Other Files'];

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 className="page-title" style={{ fontSize: '1.4rem' }}>📚 Study Library</h1>
        <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>View compiled summaries, uploaded documents, and revision materials</p>
        
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', marginTop: '4px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search library resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '36px', fontSize: '0.8rem' }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>🔍</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
        
        {/* Left Side: Virtual Folders Menu */}
        <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h4 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 6px 4px', letterSpacing: '0.5px' }}>Folders</h4>
          {foldersList.map(folder => {
            const isSelected = selectedFolder === folder;
            const count = folder === 'All' ? notes.length : notes.filter(n => getNoteFolder(n) === folder).length;
            
            return (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-input)',
                  border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  color: isSelected ? 'var(--accent-light)' : 'var(--text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? '600' : '500',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span>{getFolderIcon(folder)} {folder}</span>
                <span className="badge badge-purple" style={{ fontSize: '0.58rem', padding: '1px 5px', opacity: count > 0 ? 1 : 0.4 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Resources List */}
        <div style={{ flex: '3 1 450px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Subject Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid var(--border-subtle)' }}>
            <button 
              className={`btn btn-sm ${selectedSubjectFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedSubjectFilter('All')}
              style={{ fontSize: '0.72rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
            >
              All Subjects
            </button>
            {subjects.map(s => (
              <button 
                key={s._id || s.id}
                className={`btn btn-sm ${selectedSubjectFilter === s.name ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSelectedSubjectFilter(s.name)}
                style={{ fontSize: '0.72rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
              >
                {s.name}
              </button>
            ))}
          </div>

          {error && <div className="auth-error text-xs mb-16">{error}</div>}

          {/* Resources Grid */}
          {filteredNotes.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 12px', background: 'var(--bg-input)' }}>
              <div style={{ fontSize: '2rem' }}>📁</div>
              <h3 style={{ fontSize: '0.9rem', marginTop: '8px' }}>No items in folder</h3>
              <p style={{ fontSize: '0.78rem' }}>Uploaded documents and summaries matching filters will show here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredNotes.map((note) => {
                const id = note._id || note.id;
                const matchedSub = subjects.find(s => s.name.toLowerCase() === note.subject?.toLowerCase());
                const subColor = matchedSub?.color || 'var(--accent-primary)';
                const folder = getNoteFolder(note);
                const isFile = !!note.file_name;
                
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
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-blue" style={{ fontSize: '0.6rem' }}>Folder: {folder}</span>
                        <button 
                          onClick={() => handleDelete(id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {note.file_name ? `📁 ${note.file_name}` : (note.original_text ? `${note.original_text.slice(0, 45)}...` : 'AI Structured Study Note')}
                    </h3>
                    
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {note.summary || note.generated_notes || 'View document notes...'}
                    </p>

                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '4px' }}>
                      <button className="btn btn-outline btn-sm btn-full" onClick={() => handleViewNote(note)} style={{ padding: '6px', fontSize: '0.72rem' }}>
                        🔍 Read Note
                      </button>
                      {isFile && (
                        <a 
                          href={`${api.defaults.baseURL || ''}/api/notes/${id}/download`}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline btn-sm btn-full"
                          style={{ padding: '6px', fontSize: '0.72rem', textAlign: 'center', display: 'block' }}
                        >
                          📥 Download
                        </a>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(note)} style={{ padding: '6px', fontSize: '0.72rem' }}>
                        ✏️ Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drawer Modal: View Summary Details & Track Timer */}
      {viewNote && (
        <div className="overlay" style={{ zIndex: 1100 }}>
          <div className="modal animate-slide-up" style={{ padding: '20px', maxWidth: '450px', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.98rem' }}>📖 Studying Resource</h3>
              <button className="btn btn-ghost btn-sm" onClick={handleCloseView} style={{ fontSize: '0.9rem', padding: '4px' }}>✕</button>
            </div>
            
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{viewNote.subject}</span>
                {viewNote.file_name && <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{viewNote.file_name}</span>}
              </div>

              {/* Background timer notification */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', padding: '8px 10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#a7f3d0' }}>
                <span className="timer-pulse-dot" style={{ display: 'inline-block' }}></span>
                <span>Focus Timer Active: duration tracked automatically.</span>
              </div>

              {/* Image Preview inside Modal */}
              {viewNote.file_data && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(viewNote.file_type?.toLowerCase()) && (
                <div style={{ marginTop: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', textAlign: 'left' }}>🖼️ Image Preview</div>
                  <img 
                    src={`data:image/${viewNote.file_type || 'png'};base64,${viewNote.file_data}`}
                    alt={viewNote.file_name || 'Preview'}
                    style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              )}

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

              {viewNote.original_text && !viewNote.file_data && (
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Original Document Content</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {viewNote.original_text}
                  </p>
                </div>
              )}
            </div>

            {viewNote.file_name && (
              <a 
                href={`${api.defaults.baseURL || ''}/api/notes/${viewNote._id || viewNote.id}/download`}
                download
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-full btn-sm mt-16"
                style={{ padding: '8px', fontSize: '0.78rem', textAlign: 'center', display: 'block' }}
              >
                📥 Download Original File ({viewNote.file_name})
              </a>
            )}
            
            <button className="btn btn-primary btn-full btn-sm mt-8" onClick={handleCloseView} style={{ padding: '8px', fontSize: '0.78rem' }}>Close Details</button>
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
