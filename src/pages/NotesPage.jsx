/**
 * NotesPage.jsx — AI Summarizer & Study Notes Page.
 * Displays subject-wise study notes first, followed by the manual text/document summarizer tool.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useData } from '../context/DataContext';
import { useStudyTimer } from '../context/StudyTimerContext';

export default function NotesPage() {
  const { subjects, notes, refreshNotes, refreshSummary } = useData();
  const { startSession, stopSession } = useStudyTimer();

  // Selection & Upload Form States
  const [selectedSubject, setSelectedSubject] = useState('');
  const [form, setForm] = useState({ text: '', tags: '' });
  const [formFile, setFormFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState('');

  // Study Notes Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');
  const [expandedNotes, setExpandedNotes] = useState({});

  // Auto-select first subject in form when subjects are loaded
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubject) {
      setSelectedSubject(subjects[0]._id || subjects[0].id);
    }
  }, [subjects, selectedSubject]);

  // Monitor selected subject to automatically trigger background study timer
  useEffect(() => {
    if (selectedSubject) {
      const sub = subjects.find(s => (s._id || s.id) === selectedSubject);
      if (sub) {
        startSession(selectedSubject, sub.name);
      }
    } else {
      stopSession();
    }
    return () => stopSession();
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
      setError("Unsupported file format (.txt, .md, .pdf, .docx, or images).");
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

      setForm({ text: '', tags: '' });
      setFormFile(null);
      
      // Update global context states
      await Promise.all([refreshNotes(), refreshSummary()]);
    } catch (err) {
      setError(err.response?.data?.detail || 'AI Summarization failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this resource permanently?')) return;
    try {
      await api.delete(`/api/notes/${id}`);
      await Promise.all([refreshNotes(), refreshSummary()]);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpandNote = (id) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter study notes (combines manual uploaded summaries & auto-generated ones)
  const filteredNotes = notes.filter(note => {
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
      <div>
        <h1 className="page-title" style={{ fontSize: '1.4rem' }}>📝 Study & Summarizer</h1>
        <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>Review daily subject summaries or compile new notes</p>
      </div>

      {/* SECTION 1: AI Study Notes Library (Daily Study Material) */}
      <div className="card" style={{ padding: '16px' }}>
        <h2 className="section-title" style={{ fontSize: '1rem', marginBottom: '12px' }}>📚 AI Study Guides</h2>
        
        {/* Filter Toolbar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search study material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '0.8rem', height: '36px' }}
          />
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
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
        </div>

        {/* Study Notes List */}
        {filteredNotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem' }}>📖</div>
            <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>No daily study materials found under this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredNotes.map((note) => {
              const id = note._id || note.id;
              const matchedSub = subjects.find(s => s.name.toLowerCase() === note.subject?.toLowerCase());
              const subColor = matchedSub?.color || 'var(--accent-primary)';
              const isExpanded = !!expandedNotes[id];
              
              return (
                <div 
                  key={id} 
                  className="animate-fade-in"
                  style={{ 
                    padding: '14px', 
                    background: 'var(--bg-input)', 
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `4px solid ${subColor}`,
                    position: 'relative'
                  }}
                >
                  <button 
                    onClick={(e) => handleDeleteNote(id, e)}
                    style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    ✕
                  </button>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="badge badge-purple" style={{ background: `${subColor}15`, color: subColor, fontSize: '0.65rem', border: `1px solid ${subColor}20` }}>
                      {note.subject}
                    </span>
                    <span className="badge badge-blue" style={{ fontSize: '0.62rem' }}>
                      {note.type === 'auto_generated' ? '✨ AI Study Guide' : '📝 Manual Notes'}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', paddingRight: '20px' }}>
                    {note.original_text && note.type === 'manual' 
                      ? `${note.original_text.slice(0, 50)}${note.original_text.length > 50 ? '...' : ''}` 
                      : `${note.subject} Course Study Sheet`}
                  </h4>

                  {note.summary && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: '4px 0 8px' }}>
                      {note.summary}
                    </p>
                  )}

                  {note.generated_notes && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: '4px 0 8px' }}>
                      {note.generated_notes}
                    </p>
                  )}

                  {note.original_text && (
                    <div style={{ marginTop: '6px' }}>
                      <button 
                        className="btn btn-ghost btn-xs" 
                        onClick={() => toggleExpandNote(id)}
                        style={{ fontSize: '0.7rem', padding: '0 4px', height: 'auto', color: 'var(--text-muted)' }}
                      >
                        {isExpanded ? '▼ Hide Source' : '▶ Show Source'}
                      </button>
                      {isExpanded && (
                        <div style={{ marginTop: '6px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
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

      {/* SECTION 2: Manual AI Notes Summarizer (Form + Output) */}
      <div className="card" style={{ padding: '16px' }}>
        <h2 className="section-title" style={{ fontSize: '1rem', marginBottom: '12px' }}>⚡ Summarize Document</h2>
        
        {error && <div className="auth-error text-xs mb-16">{error}</div>}

        {subjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Add a subject category first in settings.</p>
            <Link to="/subjects" className="btn btn-primary btn-sm mt-8">Configure Subjects</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-col" onDragEnter={handleDrag} style={{ gap: '12px' }}>
            {/* Subject Selector */}
            <div className="form-group">
              <label className="form-label" htmlFor="summarizer-subject" style={{ fontSize: '0.75rem' }}>Subject Category</label>
              <select 
                id="summarizer-subject"
                className="form-input" 
                value={selectedSubject} 
                onChange={(e) => setSelectedSubject(e.target.value)}
                style={{ background: 'var(--bg-input)', fontSize: '0.8rem', height: '38px', padding: '8px 12px' }}
              >
                {subjects.map(s => (
                  <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* File Upload Zone */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Upload Document File</label>
              <div 
                className={`flex-col flex-center ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                style={{
                  border: '1.5px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  textAlign: 'center',
                  background: dragActive ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-input)',
                  cursor: 'pointer'
                }}
                onClick={() => document.getElementById('file-upload-input').click()}
              >
                <div style={{ fontSize: '1.4rem' }}>📁</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                  {formFile ? `Selected: ${formFile.name}` : 'Drag file here or click to browse'}
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
              <label className="form-label" htmlFor="summarizer-content" style={{ fontSize: '0.75rem' }}>Paste Content</label>
              <textarea 
                id="summarizer-content"
                className="form-input" 
                placeholder="Paste paragraph contents to analyze..."
                rows={4}
                value={form.text}
                onChange={(e) => setForm(f => ({ ...f, text: e.target.value }))}
                style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                required
              />
            </div>

            {/* Search tags */}
            <div className="form-group">
              <label className="form-label" htmlFor="summarizer-tags" style={{ fontSize: '0.75rem' }}>Manual Tags (comma separated)</label>
              <input 
                id="summarizer-tags"
                className="form-input" 
                placeholder="e.g. key-formulas, exam-prep" 
                value={form.tags}
                onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                style={{ fontSize: '0.8rem', height: '38px', padding: '8px 12px' }}
              />
            </div>

            <button 
              type="submit" 
              className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`} 
              disabled={loading}
              style={{ padding: '10px 16px', fontSize: '0.85rem' }}
            >
              {loading ? 'Summarizing...' : '✨ Save & Summarize'}
            </button>
          </form>
        )}

        {/* Live Output Section */}
        {successData && (
          <div className="animate-fade-in flex-col" style={{ gap: '8px', marginTop: '16px', padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
            <div className="flex-between">
              <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>Summarized & Saved</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0 }}>
              {successData.summary}
            </p>
            <button className="btn btn-outline btn-xs" onClick={() => setSuccessData(null)} style={{ fontSize: '0.7rem', padding: '4px 8px', alignSelf: 'flex-start' }}>Clear Output</button>
          </div>
        )}
      </div>
    </div>
  );
}
