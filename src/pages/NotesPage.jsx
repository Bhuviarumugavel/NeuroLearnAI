/**
 * NotesPage.jsx — AI Summarizer & Timetable Study Page.
 * Displays subject-wise study notes first, featuring two views:
 * 1. Timetable Notes (Daily topics for study based on timeline).
 * 2. Study & Quiz Analytics (Tracks focus duration and last quiz attend times).
 * Features a manual documents summarizer directly below.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useData } from '../context/DataContext';
import { useStudyTimer } from '../context/StudyTimerContext';

export default function NotesPage() {
  const { subjects, notes, quizzes, plans, refreshNotes, refreshSummary } = useData();
  const { startSession, stopSession } = useStudyTimer();

  // Selection & Upload Form States
  const [selectedSubject, setSelectedSubject] = useState('');
  const [form, setForm] = useState({ text: '', tags: '' });
  const [formFile, setFormFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState('');

  // AI Study Guides View Modes: 'timetable' | 'analytics'
  const [studyViewMode, setStudyViewMode] = useState('timetable');

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');
  const [expandedNotes, setExpandedNotes] = useState({});

  // Auto-select first subject on load
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

  const getTopicDateStr = (planCreatedAt, topicDay) => {
    if (!planCreatedAt) return '';
    const start = new Date(planCreatedAt);
    start.setDate(start.getDate() + (topicDay - 1));
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  };

  // Helper: Format focus time duration
  const formatFocusTime = (secs) => {
    if (!secs) return '0 mins';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  // Option 1 Filter: Timetable Scheduled study notes matching subjects
  const getTimetableNotes = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return subjects.map(sub => {
      const plan = plans.find(p => p.subject_name.toLowerCase() === sub.name.toLowerCase());
      
      // Find today's topic or default to first incomplete topic
      let activeTopic = null;
      if (plan && plan.topics) {
        activeTopic = plan.topics.find(t => getTopicDateStr(plan.created_at, t.day) === todayStr);
        if (!activeTopic) {
          activeTopic = plan.topics.find(t => !t.completed);
        }
      }

      // Find notes matching this subject
      const matchingNotes = notes.filter(n => n.subject.toLowerCase() === sub.name.toLowerCase());

      return {
        subject: sub,
        topic: activeTopic,
        notes: matchingNotes
      };
    });
  };

  const timetableData = getTimetableNotes();

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="page-title" style={{ fontSize: '1.4rem' }}>📝 Study & Summarizer</h1>
        <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>Review timetable study notes or verify focus metrics</p>
      </div>

      {/* SECTION 1: AI Study Guides Option Selector */}
      <div className="card" style={{ padding: '16px' }}>
        
        {/* Toggle options for Timetable or Analytics */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '14px' }}>
          <button 
            className={`btn btn-sm ${studyViewMode === 'timetable' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStudyViewMode('timetable')}
            style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
          >
            📅 Timetable Notes
          </button>
          <button 
            className={`btn btn-sm ${studyViewMode === 'analytics' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStudyViewMode('analytics')}
            style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
          >
            ⏱️ Study & Quiz Tracker
          </button>
        </div>

        {/* View Mode 1: Timetable Scheduled Study Materials */}
        {studyViewMode === 'timetable' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              💡 displaying scheduled lessons for each subject based on your timetable.
            </div>

            {subjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.8rem' }}>No subjects added. Configure subjects to view study timetables.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {timetableData.map(({ subject, topic, notes: subNotes }) => {
                  const subColor = subject.color || 'var(--accent-primary)';
                  
                  return (
                    <div 
                      key={subject.id || subject._id}
                      style={{
                        padding: '12px',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: `4px solid ${subColor}`
                      }}
                    >
                      <div className="flex-between" style={{ marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{subject.name}</span>
                        {topic && (
                          <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>
                            Day {topic.day}: {topic.name}
                          </span>
                        )}
                      </div>

                      {/* Display Syllabus outline */}
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 8px', fontStyle: 'italic' }}>
                        Outline: {subject.description || 'General curriculum overview.'}
                      </p>

                      {/* Timetable Guides notes */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Study Guides ({subNotes.length})</div>
                        
                        {subNotes.length === 0 ? (
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>No summaries saved yet. Use the tool below to generate.</p>
                        ) : (
                          subNotes.map((note) => {
                            const noteId = note._id || note.id;
                            const isExpanded = !!expandedNotes[noteId];
                            
                            return (
                              <div key={noteId} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', position: 'relative' }}>
                                <button 
                                  onClick={(e) => handleDeleteNote(noteId, e)}
                                  style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem' }}
                                >
                                  ✕
                                </button>
                                
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', paddingRight: '16px' }}>
                                  {note.type === 'auto_generated' ? '✨ AI Study Guide' : '📝 Uploaded Notes'}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                  {note.summary || note.generated_notes}
                                </p>
                                
                                {note.original_text && (
                                  <div>
                                    <button 
                                      className="btn btn-ghost btn-xs" 
                                      onClick={() => toggleExpandNote(noteId)}
                                      style={{ fontSize: '0.65rem', padding: 0, height: 'auto', color: 'var(--text-muted)', marginTop: '2px' }}
                                    >
                                      {isExpanded ? '▼ Hide Source' : '▶ Show Source'}
                                    </button>
                                    {isExpanded && (
                                      <div style={{ marginTop: '4px', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: '80px', overflowY: 'auto' }}>
                                        {note.original_text}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* View Mode 2: Study Tracker & Quiz Analytics */}
        {studyViewMode === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              📊 Detailed study focus durations and quiz completion metrics per subject.
            </div>

            {subjects.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>Configure subjects to view tracker metrics.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {subjects.map(sub => {
                  const subColor = sub.color || 'var(--accent-primary)';
                  
                  // Calculate time of study
                  const focusSecs = sub.study_time_seconds || 0;
                  const focusFormatted = formatFocusTime(focusSecs);

                  // Calculate quiz attempts & last quiz attend time
                  const subQuizzes = quizzes.filter(q => q.subject.toLowerCase() === sub.name.toLowerCase());
                  
                  let lastAttemptTime = 'No quiz taken yet';
                  let lastScore = null;
                  
                  if (subQuizzes.length > 0) {
                    const attempts = subQuizzes.flatMap(q => q.attempts || []);
                    if (attempts.length > 0) {
                      // Sort by attempted_at descending
                      attempts.sort((a, b) => new Date(b.attempted_at) - new Date(a.attempted_at));
                      const last = attempts[0];
                      lastAttemptTime = new Date(last.attempted_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      });
                      lastScore = Math.round((last.score / last.total) * 100);
                    }
                  }

                  return (
                    <div 
                      key={sub.id || sub._id}
                      style={{
                        padding: '12px',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: `4px solid ${subColor}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div className="flex-between">
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{sub.name}</span>
                        <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>{sub.priority} Priority</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                        {/* Time of Study */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>⏱️ Time of Study</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-light)', marginTop: '2px' }}>{focusFormatted}</div>
                        </div>

                        {/* Quiz Attend Time */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>🧩 Quiz Last Attend</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lastAttemptTime}>
                            {lastAttemptTime}
                          </div>
                          {lastScore !== null && (
                            <span className={`badge ${lastScore >= 80 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.58rem', padding: '1px 4px', marginTop: '4px' }}>
                              Score: {lastScore}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
