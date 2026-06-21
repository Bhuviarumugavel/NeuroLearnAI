/**
 * NotesPage.jsx — AI Summarizer Page
 * Enables users to upload text or files to instantly generate AI summaries.
 * Displays existing summary notes for all subjects in a searchable catalog.
 * Automatically triggers the Smart Study Timer for the selected subject.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useStudyTimer } from '../context/StudyTimerContext';

export default function NotesPage() {
  const { startSession, stopSession } = useStudyTimer();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [form, setForm] = useState({ text: '', tags: '' });
  const [formFile, setFormFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState('');

  // Catalog states
  const [savedNotes, setSavedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewNote, setViewNote] = useState(null); // Active document modal

  // Fetch subjects for select list
  useEffect(() => {
    api.get('/api/subjects')
      .then((r) => {
        const list = r.data.subjects || [];
        setSubjects(list);
        if (list.length > 0) {
          setSelectedSubject(list[0]._id || list[0].id);
        }
      })
      .catch(() => {});
    loadNotesCatalog();
  }, []);

  const loadNotesCatalog = async () => {
    try {
      const res = await api.get('/api/notes');
      setSavedNotes(res.data.notes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Monitor selected subject to automatically trigger/update background study timer
  useEffect(() => {
    if (selectedSubject) {
      const sub = subjects.find(s => (s._id || s.id) === selectedSubject);
      if (sub) {
        startSession(selectedSubject, sub.name);
      }
    }
  }, [selectedSubject, subjects]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseFile = (file) => {
    if (!file) return;
    const validExtensions = ['.txt', '.md', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp'];
    const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isValid = validExtensions.includes(fileExt) || file.type.startsWith('image/') || file.type === 'application/pdf';
    
    if (!isValid) {
      setError("Unsupported file format. Please upload text (.txt, .md), PDF (.pdf), Word (.docx) or Image files.");
      setFormFile(null);
      return;
    }
    
    setError('');
    setFormFile(file);
    setForm(f => ({ ...f, text: `[Selected file: ${file.name} - Will be parsed and summarized on submit]` }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      parseFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const activeSub = subjects.find(s => (s._id || s.id) === selectedSubject);
    if (!activeSub) {
      setError('Please add a subject in Subject Settings first.');
      return;
    }
    const subjectTag = activeSub.name;

    if (!formFile && !form.text.trim()) {
      setError('Please paste study content or drop a file to summarize.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessData(null);

    try {
      let res;
      if (formFile) {
        const formData = new FormData();
        formData.append('file', formFile);
        formData.append('subject_tag', subjectTag);
        
        res = await api.post('/api/notes/upload-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        res = await api.post('/api/notes', {
          text: form.text,
          subject_tag: subjectTag
        });
      }

      setSuccessData({
        summary: res.data.summary,
        subject: subjectTag,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [subjectTag, 'AI Summary']
      });

      // Clear input form
      setForm({ text: '', tags: '' });
      setFormFile(null);
      
      // Auto-stop timer session
      stopSession();
      
      // Reload catalog to show the new summary note
      await loadNotesCatalog();
    } catch (err) {
      setError(err.response?.data?.detail || 'AI Summarization failed. Please verify connection and try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteNote = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this resource permanently?')) return;
    try {
      await api.delete(`/api/notes/${id}`);
      setSavedNotes(prev => prev.filter(n => (n._id || n.id) !== id));
      if (viewNote && (viewNote._id || viewNote.id) === id) {
        setViewNote(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotes = savedNotes.filter(note => {
    const query = searchQuery.toLowerCase();
    return (
      note.subject?.toLowerCase().includes(query) ||
      note.summary?.toLowerCase().includes(query) ||
      note.original_text?.toLowerCase().includes(query) ||
      note.generated_notes?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">📝 AI Summarizer</h1>
        <p className="page-subtitle">Upload course text or files to summarize, and view saved summaries of every subject</p>
      </div>

      {/* Main Workspace Grid: Split view */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Summarizer Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="card">
            <h2 className="section-title">⚡ Summarize Document</h2>
            {error && <div className="auth-error mb-16">{error}</div>}

            {subjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📚</div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Add a Subject First</h3>
                <p className="text-muted text-sm mb-16">You need to have at least one subject configured to assign summaries.</p>
                <Link to="/subjects" className="btn btn-primary btn-sm">Configure Subjects</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-col" onDragEnter={handleDrag} id="summarizer-form">
                
                {/* Subject Selector */}
                <div className="form-group">
                  <label className="form-label" htmlFor="summarizer-subject">Select Subject Category</label>
                  <select 
                    id="summarizer-subject"
                    className="form-input" 
                    value={selectedSubject} 
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    style={{ background: 'var(--bg-input)', cursor: 'pointer' }}
                  >
                    {subjects.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted">⏱️ Background focus timer tracks time spent studying this subject.</span>
                </div>

                {/* File Upload zone */}
                <div className="form-group">
                  <label className="form-label">Upload Notes File (Text, PDF, DOCX, Image)</label>
                  <div 
                    className={`flex-col flex-center ${dragActive ? 'drag-active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '20px',
                      textAlign: 'center',
                      background: dragActive ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-input)',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onClick={() => document.getElementById('file-upload-input').click()}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>📁</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {formFile ? `Selected: ${formFile.name}` : 'Drag & Drop or Click to Upload'}
                    </div>
                    <input 
                      id="file-upload-input" 
                      type="file" 
                      accept=".txt,.md,.pdf,.docx,image/*"
                      onChange={handleFileChange} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                </div>

                {/* Raw Text Input */}
                <div className="form-group">
                  <label className="form-label" htmlFor="summarizer-content">Or Paste Study Material Content *</label>
                  <textarea 
                    id="summarizer-content"
                    className="form-input" 
                    placeholder="Type or paste textbook paragraphs, lecture slides, or syllabus notes here..."
                    rows={6}
                    value={form.text}
                    onChange={(e) => setForm(f => ({ ...f, text: e.target.value }))}
                    style={{ resize: 'vertical' }}
                    required
                  />
                </div>

                {/* Search tags */}
                <div className="form-group">
                  <label className="form-label" htmlFor="summarizer-tags">Manual Search Tags (comma separated)</label>
                  <input 
                    id="summarizer-tags"
                    className="form-input" 
                    placeholder="e.g. formulas, homework, Lecture 1" 
                    value={form.tags}
                    onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                  />
                </div>

                <button 
                  type="submit" 
                  id="summarizer-submit"
                  className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`} 
                  disabled={loading}
                >
                  {loading ? 'Analyzing Content...' : '✨ Save & Summarize'}
                </button>
              </form>
            )}
          </div>

          {/* Success summary output display (under form or as overlay) */}
          {successData && (
            <div className="card card-glow animate-fade-in" style={{ borderLeft: '4px solid var(--accent-green)' }}>
              <div className="flex-between mb-8">
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>📋 AI Summary Output</h3>
                <span className="badge badge-green">Saved</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap', background: 'var(--bg-input)', padding: '10px', borderRadius: '6px' }}>
                {successData.summary}
              </p>
              <button className="btn btn-ghost btn-xs mt-8" onClick={() => setSuccessData(null)}>Clear Result</button>
            </div>
          )}

        </div>

        {/* Right Column: Summaries Catalog of every subject */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '500px' }}>
          
          <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>📚 Subject Summaries Catalog</h2>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search summaries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: '200px', height: '34px', fontSize: '0.8rem', padding: '0 10px' }}
            />
          </div>

          {loadingNotes ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', flex: 1 }}>
              <span className="spinner"></span>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', flex: 1 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📖</div>
              <h3>No Summaries Found</h3>
              <p style={{ fontSize: '0.82rem' }}>Summaries and auto-notes generated for your subjects will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', overflowY: 'auto', maxHeight: '600px', paddingRight: '4px' }}>
              {filteredNotes.map((note) => {
                const id = note._id || note.id;
                const matchedSub = subjects.find(s => s.name.toLowerCase() === note.subject?.toLowerCase());
                const subColor = matchedSub?.color || 'var(--accent-primary)';
                
                return (
                  <div 
                    key={id} 
                    className="card animate-fade-in"
                    onClick={() => setViewNote(note)}
                    style={{ 
                      padding: '12px 16px', 
                      background: 'var(--bg-input)', 
                      border: '1px solid var(--border-subtle)',
                      borderLeft: `4px solid ${subColor}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    <button 
                      onClick={(e) => handleDeleteNote(id, e)}
                      style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ✕
                    </button>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <span className="badge badge-purple" style={{ fontSize: '0.68rem', padding: '2px 6px', background: `${subColor}20`, color: subColor, border: `1px solid ${subColor}40` }}>
                        {note.subject}
                      </span>
                      <span className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {note.note_type === 'auto_generated' ? '✨ AI Auto Notes' : '📝 Manual'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', paddingRight: '20px' }}>
                      {note.original_text ? `${note.original_text.slice(0, 40)}...` : 'AI Structured Course Note'}
                    </h4>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {note.summary || note.generated_notes || 'View document preview.'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* Drawer Modal: View Summary Details & Study */}
      {viewNote && (
        <div className="overlay">
          <div className="modal animate-slide-up" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📖 Summary Details
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewNote(null)} style={{ fontSize: '1rem', padding: '4px 8px' }}>✕</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="badge badge-purple">Category: {viewNote.subject}</span>
                <span className="badge badge-blue">{viewNote.note_type === 'auto_generated' ? '✨ AI Auto Notes' : '📝 Manual'}</span>
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
