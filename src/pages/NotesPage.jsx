/**
 * NotesPage.jsx — AI Summarizer Page
 * Enables users to upload text or files to instantly generate AI summaries.
 * Automatically triggers the Smart Study Timer for the selected subject.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useStudyTimer } from '../context/StudyTimerContext';

export default function NotesPage() {
  const { startSession, stopSession, activeSubjectId } = useStudyTimer();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [form, setForm] = useState({ text: '', tags: '' });
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState('');

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
  }, []);

  // Monitor selected subject to automatically trigger/update background study timer!
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
    const isText = file.type === "text/plain" || file.name.endsWith('.txt') || file.name.endsWith('.md');
    if (!isText) {
      setError("Note: Live parsing is currently supported for plain text (.txt, .md) files. For other formats (PDF, Docx), upload them manually or paste the text content.");
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      setForm(f => ({ ...f, text: e.target.result }));
    };
    reader.readAsText(file);
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
    if (!form.text.trim()) {
      setError('Please paste study content or drop a file to summarize.');
      return;
    }
    if (!selectedSubject) {
      setError('Please add a subject in Subject Settings first.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessData(null);

    const activeSub = subjects.find(s => (s._id || s.id) === selectedSubject);
    const subjectTag = activeSub ? activeSub.name : 'General';

    try {
      const res = await api.post('/api/notes', {
        text: form.text,
        subject_tag: subjectTag
      });

      setSuccessData({
        summary: res.data.summary,
        subject: subjectTag,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [subjectTag, 'AI Summary']
      });

      // Clear input form
      setForm({ text: '', tags: '' });
      
      // Auto-stop timer session for this summarization block (accumulated study time will sync)
      stopSession();
    } catch (err) {
      setError(err.response?.data?.detail || 'AI Summarization failed. Please verify connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">📝 AI Summarizer</h1>
        <p className="page-subtitle">Upload notes, documents, or paste content to instantly generate summaries</p>
      </div>

      {/* Main Workspace Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: successData ? '1fr 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Summarizer Form Card */}
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
                <span className="text-xs text-muted">⏱️ Background focus timer will track time spent studying this subject.</span>
              </div>

              {/* File Drag and Drop / Input Area */}
              <div className="form-group">
                <label className="form-label">Upload PDF, Docx, Image or Text File</label>
                <div 
                  className={`flex-col flex-center ${dragActive ? 'drag-active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '24px',
                    textAlign: 'center',
                    background: dragActive ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-input)',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onClick={() => document.getElementById('file-upload-input').click()}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📁</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Drag & Drop or Click to Upload</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Supports PDF, Word, images, or .txt notes</div>
                  <input 
                    id="file-upload-input" 
                    type="file" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }} 
                  />
                </div>
              </div>

              {/* Raw Text Content Input */}
              <div className="form-group">
                <label className="form-label" htmlFor="summarizer-content">Or Paste Study Material Content *</label>
                <textarea 
                  id="summarizer-content"
                  className="form-input" 
                  placeholder="Type or paste study materials, textbook paragraphs, or articles here..."
                  rows={8}
                  value={form.text}
                  onChange={(e) => setForm(f => ({ ...f, text: e.target.value }))}
                  style={{ resize: 'vertical' }}
                  required
                />
              </div>

              {/* Metadata tags */}
              <div className="form-group">
                <label className="form-label" htmlFor="summarizer-tags">Manual Search Tags (comma separated)</label>
                <input 
                  id="summarizer-tags"
                  className="form-input" 
                  placeholder="e.g. midterms, Chapter 1, formula sheets" 
                  value={form.tags}
                  onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button 
                  type="submit" 
                  id="summarizer-submit"
                  className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`} 
                  disabled={loading}
                >
                  {loading ? 'Analyzing Content...' : '✨ Save & Summarize'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Success / Summary Result Panel */}
        {successData && (
          <div className="card card-glow animate-fade-in" style={{ borderLeft: '4px solid var(--accent-green)' }}>
            <div className="flex-between mb-16">
              <h2 className="section-title" style={{ margin: 0 }}>📋 AI Summary Output</h2>
              <span className="badge badge-green">Auto-Saved</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <span className="badge badge-purple">Subject: {successData.subject}</span>
              {successData.tags.map(t => (
                <span key={t} className="badge badge-blue">{t}</span>
              ))}
            </div>

            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>AI-Generated Insights</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {successData.summary}
              </p>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <Link to="/library" className="btn btn-outline btn-full btn-sm">📁 View in Study Library</Link>
              <button className="btn btn-ghost btn-full btn-sm" onClick={() => setSuccessData(null)}>Clear Result</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
