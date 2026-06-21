/**
 * NotesPage.jsx — AI Summarizer & Study Notes Page
 * Enables users to upload text or files to instantly generate AI summaries.
 * Organizes and displays saved summaries and study guides for study.
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

  // Tabs: 'summarizer' (Manual AI Summarizer) | 'library' (AI Study Notes)
  const [activeTab, setActiveTab] = useState('summarizer');

  // Catalog / Library states
  const [savedNotes, setSavedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');
  const [expandedNotes, setExpandedNotes] = useState({}); // Tracking which original texts are open

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
    if (selectedSubject && activeTab === 'summarizer') {
      const sub = subjects.find(s => (s._id || s.id) === selectedSubject);
      if (sub) {
        startSession(selectedSubject, sub.name);
      }
    } else {
      stopSession();
    }
  }, [selectedSubject, activeTab, subjects]);

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
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpandNote = (id) => {
    setExpandedNotes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filter notes by subject selection and search query (only manual notes in the AI Summarizer catalog)
  const filteredNotes = savedNotes.filter(note => {
    if (note.type !== 'manual') return false;
    const matchesSubject = selectedSubjectFilter === 'All' || (note.subject && note.subject.toLowerCase() === selectedSubjectFilter.toLowerCase());
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || (
      (note.subject && note.subject.toLowerCase().includes(query)) ||
      (note.summary && note.summary.toLowerCase().includes(query)) ||
      (note.original_text && note.original_text.toLowerCase().includes(query)) ||
      (note.generated_notes && note.generated_notes.toLowerCase().includes(query))
    );
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">📝 AI Summarizer</h1>
        <p className="page-subtitle">Upload text or documents to summarize, and study compiled subject summaries</p>
      </div>

      {/* Tab Control Header */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '24px' }}>
        <button 
          className={`btn ${activeTab === 'summarizer' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setActiveTab('summarizer'); setError(''); setSuccessData(null); }}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
        >
          ⚡ Manual AI Summarizer
        </button>
        <button 
          className={`btn ${activeTab === 'library' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setActiveTab('library'); setError(''); setSuccessData(null); }}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
        >
          📚 AI Study Notes ({savedNotes.filter(n => n.type === 'manual').length})
        </button>
      </div>

      {/* Tab content 1: Manual AI Summarizer */}
      {activeTab === 'summarizer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Form */}
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

                {/* File Upload Zone */}
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

          {/* Right Column: Live Output Preview */}
          <div className="card" style={{ height: '100%', minHeight: '400px' }}>
            <h2 className="section-title">📋 Live Summary Output</h2>
            {successData ? (
              <div className="animate-fade-in flex-col" style={{ gap: '16px' }}>
                <div className="flex-between">
                  <span className="badge badge-purple">Category: {successData.subject}</span>
                  <span className="badge badge-green">Saved to Library</span>
                </div>
                <div style={{ background: 'var(--bg-input)', borderLeft: '4px solid var(--accent-light)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: '6px' }}>AI Generated Summary Points</div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {successData.summary}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {successData.tags.map(t => <span key={t} className="badge badge-blue" style={{ fontSize: '0.7rem' }}>#{t}</span>)}
                </div>
                <button className="btn btn-outline btn-sm mt-8" onClick={() => setSuccessData(null)}>Clear Output</button>
              </div>
            ) : (
              <div className="flex-col flex-center text-muted" style={{ padding: '60px 20px', textAlign: 'center', height: '100%', justifyContent: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✨</div>
                <h3>No Live Output</h3>
                <p style={{ fontSize: '0.82rem', maxWidth: '300px' }}>Pasted content or uploaded files will show their generated summaries here immediately after creation.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content 2: AI Study Notes */}
      {activeTab === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Filtering and Search Controls */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '20px', alignItems: 'center' }}>
              {/* Subject Tabs */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
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
              
              {/* Search input */}
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search summaries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ height: '36px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Summarized Notes list rendered directly for study */}
          {loadingNotes ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <span className="spinner"></span>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="card flex-col flex-center text-muted" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📖</div>
              <h3>No Summarized Notes Found</h3>
              <p style={{ fontSize: '0.82rem' }}>Summaries and auto-notes generated for your subjects will appear here once added.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {filteredNotes.map((note) => {
                const id = note._id || note.id;
                const matchedSub = subjects.find(s => s.name.toLowerCase() === note.subject?.toLowerCase());
                const subColor = matchedSub?.color || 'var(--accent-primary)';
                const isExpanded = !!expandedNotes[id];
                
                return (
                  <div 
                    key={id} 
                    className="card animate-fade-in"
                    style={{ 
                      padding: '24px', 
                      background: 'var(--bg-card)', 
                      border: '1px solid var(--border-subtle)',
                      borderLeft: `5px solid ${subColor}`,
                      position: 'relative'
                    }}
                  >
                    {/* Delete Note Button */}
                    <button 
                      onClick={(e) => handleDeleteNote(id, e)}
                      style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}
                      title="Delete summary notes"
                    >
                      ✕
                    </button>

                    {/* Subject & Type Header */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="badge badge-purple" style={{ background: `${subColor}15`, color: subColor, border: `1px solid ${subColor}30`, fontSize: '0.72rem' }}>
                        {note.subject}
                      </span>
                      <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>
                        {note.type === 'auto_generated' ? '✨ AI Study Guide' : '📝 Manual Notes'}
                      </span>
                      <span className="text-xs text-muted" style={{ marginLeft: 'auto', marginRight: '24px' }}>
                        {note.created_at ? new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </span>
                    </div>

                    {/* Note Title */}
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', paddingRight: '32px' }}>
                      {note.original_text && note.type === 'manual' 
                        ? `${note.original_text.slice(0, 80)}${note.original_text.length > 80 ? '...' : ''}` 
                        : `${note.subject} Course Study Sheet`}
                    </h3>

                    {/* AI Summary Section */}
                    {note.summary && (
                      <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-light)', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>AI Summary Points</div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>
                          {note.summary}
                        </p>
                      </div>
                    )}

                    {/* AI Auto-Generated Content (e.g. starter notes) */}
                    {note.generated_notes && (
                      <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-purple)', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>AI Generated Study Guide</div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>
                          {note.generated_notes}
                        </p>
                      </div>
                    )}

                    {/* Expandable Original Source Content */}
                    {note.original_text && (
                      <div style={{ marginTop: '10px' }}>
                        <button 
                          className="btn btn-ghost btn-xs" 
                          onClick={() => toggleExpandNote(id)}
                          style={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: 0 }}
                        >
                          {isExpanded ? '▼ Hide Original Source Text' : '▶ Show Original Source Text'}
                        </button>
                        
                        {isExpanded && (
                          <div 
                            className="animate-fade-in"
                            style={{ 
                              marginTop: '8px', 
                              padding: '12px', 
                              background: 'rgba(255,255,255,0.01)', 
                              border: '1px solid var(--border-subtle)', 
                              borderRadius: 'var(--radius-md)', 
                              fontSize: '0.8rem', 
                              color: 'var(--text-secondary)', 
                              lineHeight: '1.5', 
                              whiteSpace: 'pre-wrap' 
                            }}
                          >
                            {note.original_text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
