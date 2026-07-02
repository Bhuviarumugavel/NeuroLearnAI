/**
 * NotesPage.jsx — AI Summarizer & Timetable Study Page.
 * Restructured to support:
 * 1. Study Notes & Time Tracker (Option 1)
 *    - Displays subject study notes.
 *    - Integrates live focus timer and study time calculations.
 * 2. Manual Unit Summarizer (Option 2)
 *    - Generates specialized summaries for time management from unit notes.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useData } from '../context/DataContext';
import { useStudyTimer } from '../context/StudyTimerContext';

export default function NotesPage() {
  const { subjects, notes, plans, refreshNotes, refreshSummary } = useData();
  const { activeSubjectId, secondsElapsed, isActive, startSession, stopSession } = useStudyTimer();

  // Primary page tab: 'study' (Option 1) | 'manual' (Option 2)
  const [activeTab, setActiveTab] = useState('study');

  // Manual summarizer form states
  const [selectedSubject, setSelectedSubject] = useState('');
  const [summaryType, setSummaryType] = useState('time_management'); // 'time_management' (default) | 'general'
  const [form, setForm] = useState({ text: '', tags: '' });
  const [formFile, setFormFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState('');

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});

  // Auto-select first subject in manual dropdown on load
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubject) {
      setSelectedSubject(subjects[0]._id || subjects[0].id);
    }
  }, [subjects, selectedSubject]);

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
        formData.append('summary_type', summaryType);
        
        res = await api.post('/api/notes/upload-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        res = await api.post('/api/notes', {
          text: form.text,
          subject_tag: subjectTag,
          summary_type: summaryType
        });
      }

      setSuccessData({
        summary: res.data.summary,
        subject: subjectTag,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [subjectTag, summaryType === 'time_management' ? 'Time Management' : 'AI Summary']
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

  // Helper: Format focus time duration
  const formatFocusTime = (secs) => {
    if (!secs) return '0 mins';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  const getTopicDateStr = (planCreatedAt, topicDay) => {
    if (!planCreatedAt) return '';
    const start = new Date(planCreatedAt);
    start.setDate(start.getDate() + (topicDay - 1));
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  };

  const getTodayTopicForSubject = (subjectName) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const plan = plans.find(p => p.subject_name.toLowerCase() === subjectName.toLowerCase());
    
    if (plan && plan.topics) {
      // 1. Try to find topic scheduled for today
      let topic = plan.topics.find(t => getTopicDateStr(plan.created_at, t.day) === todayStr);
      if (topic) return topic;
      
      // 2. Fallback to first incomplete topic
      topic = plan.topics.find(t => !t.completed);
      if (topic) return topic;
      
      // 3. Fallback to last topic if all complete
      if (plan.topics.length > 0) {
        return plan.topics[plan.topics.length - 1];
      }
    }
    return null;
  };

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h1 className="page-title" style={{ fontSize: '1.4rem' }}>📝 Study & Summarizer</h1>
        <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>Study subject notes, calculate focus durations, or create specialized summaries</p>
      </div>

      {/* Main Tab Toggle: Option 1 vs Option 2 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button 
          className={`btn ${activeTab === 'study' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('study')}
          style={{ flex: 1, fontSize: '0.8rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          📚 Study Notes & Tracker
        </button>
        <button 
          className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('manual')}
          style={{ flex: 1, fontSize: '0.8rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          ⚡ Manual Unit Summarizer
        </button>
      </div>

      {/* OPTION 1: Study Notes & Time Tracker */}
      {activeTab === 'study' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Notes list filter bar */}
          <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>🔍 Search Notes:</span>
            <input 
              className="form-input" 
              placeholder="Filter study notes content..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, fontSize: '0.78rem', height: '32px', padding: '6px 12px' }}
            />
          </div>

          {subjects.length === 0 ? (
            <div className="card flex-col flex-center text-muted" style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>📚</div>
              <p style={{ fontSize: '0.82rem', marginTop: '8px' }}>No subjects added yet.</p>
              <Link to="/subjects" className="btn btn-primary btn-sm mt-8">Configure Subjects</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {subjects.map((sub) => {
                const subId = sub._id || sub.id;
                const isCurrentStudying = activeSubjectId === subId && isActive;
                const subColor = sub.color || 'var(--accent-primary)';
                
                // Dynamic time of study calculation (database base + active session runtime)
                const currentFocusSecs = (sub.study_time_seconds || 0) + (isCurrentStudying ? secondsElapsed : 0);
                const currentFocusFormatted = formatFocusTime(currentFocusSecs);

                // Fetch active scheduled topic
                const activeTopic = getTodayTopicForSubject(sub.name);

                // Fetch notes matching this subject
                let matchingNotes = notes.filter(n => n.subject.toLowerCase() === sub.name.toLowerCase());
                if (activeTopic) {
                  const topicKeywords = activeTopic.name.toLowerCase();
                  const topicSpecificNotes = matchingNotes.filter(n => 
                    (n.summary || '').toLowerCase().includes(topicKeywords) || 
                    (n.original_text || '').toLowerCase().includes(topicKeywords)
                  );
                  if (topicSpecificNotes.length > 0) {
                    matchingNotes = topicSpecificNotes;
                  }
                }

                if (searchQuery.trim()) {
                  const query = searchQuery.toLowerCase();
                  matchingNotes = matchingNotes.filter(n => 
                    (n.summary || '').toLowerCase().includes(query) || 
                    (n.generated_notes || '').toLowerCase().includes(query) ||
                    (n.original_text || '').toLowerCase().includes(query)
                  );
                }

                return (
                  <div 
                    key={subId}
                    className="card"
                    style={{
                      borderLeft: `4px solid ${subColor}`,
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: isCurrentStudying ? `0 0 12px ${subColor}25` : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {/* Header Row */}
                    <div className="flex-between" style={{ paddingBottom: isCurrentStudying ? '8px' : '0px', borderBottom: isCurrentStudying ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: subColor }}></span>
                          {sub.name}
                        </h3>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                          Priority: <strong>{sub.priority}</strong>
                        </p>
                      </div>
                      
                      {/* Live Study Session Trigger */}
                      <div>
                        {isCurrentStudying ? (
                          <button 
                            className="btn btn-red btn-sm btn-pulse" 
                            onClick={stopSession}
                            style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            ⏹️ Stop Studying
                          </button>
                        ) : (
                          <button 
                            className="btn btn-outline btn-sm" 
                            onClick={() => startSession(subId, sub.name)}
                            style={{ fontSize: '0.75rem', padding: '6px 12px', borderColor: subColor, color: subColor }}
                          >
                            📖 Start Studying
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Today's Target Topic & Notes List (Only shown when active studying session is running!) */}
                    {isCurrentStudying && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                        
                        {/* Dynamic study duration timer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>⏱️ Study focus session duration:</span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {currentFocusFormatted}
                            <span className="timer-pulse-dot"></span>
                          </span>
                        </div>

                        {/* Today's Target Topic display */}
                        <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Today's Target Topic</span>
                          {activeTopic ? (
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                              Day {activeTopic.day}: {activeTopic.name} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>({activeTopic.duration} mins target)</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                              No topic scheduled for today in the study plan.
                            </div>
                          )}
                        </div>

                        {/* Notes list for today's topic */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Today's Study Notes ({matchingNotes.length})
                          </span>

                          {matchingNotes.length === 0 ? (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>
                              No study notes generated for today's topic. Go to the "Manual Unit Summarizer" tab to generate one.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {matchingNotes.map((note) => {
                                const noteId = note._id || note.id;
                                const isExpanded = !!expandedNotes[noteId];
                                const isTimeMgmtSummary = note.summary?.includes('Time Management') || note.summary?.includes('Estimated Study Time') || note.summary?.includes('|');
                                
                                return (
                                  <div 
                                    key={noteId} 
                                    style={{ 
                                      background: 'rgba(255,255,255,0.01)', 
                                      border: '1px solid var(--border-subtle)', 
                                      padding: '10px', 
                                      borderRadius: 'var(--radius-md)', 
                                      position: 'relative' 
                                    }}
                                  >
                                    <button 
                                      onClick={(e) => handleDeleteNote(noteId, e)}
                                      style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem' }}
                                      title="Delete note"
                                    >
                                      ✕
                                    </button>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {note.type === 'auto_generated' ? '✨ AI Study Guide' : '📝 Manual Summary'}
                                      </span>
                                      <span className={`badge ${isTimeMgmtSummary ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
                                        {isTimeMgmtSummary ? 'Time Management' : 'General Summary'}
                                      </span>
                                    </div>

                                    <div className="markdown-content" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                                      {note.summary || note.generated_notes}
                                    </div>
                                    
                                    {note.original_text && (
                                      <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '6px' }}>
                                        <button 
                                          className="btn btn-ghost btn-xs" 
                                          onClick={() => toggleExpandNote(noteId)}
                                          style={{ fontSize: '0.62rem', padding: 0, height: 'auto', color: 'var(--text-muted)' }}
                                        >
                                          {isExpanded ? '▼ Hide Original Text' : '▶ Show Original Text'}
                                        </button>
                                        {isExpanded && (
                                          <div style={{ marginTop: '6px', padding: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
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

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* OPTION 2: Manual Unit Summarizer */}
      {activeTab === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="card" style={{ padding: '16px' }}>
            <h2 className="section-title" style={{ fontSize: '1rem', marginBottom: '4px' }}>⚡ AI Unit Summarizer</h2>
            <p className="page-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Upload unit notes or paste content. The system will summarize key concepts, estimate mastering times, and prioritize concepts to optimize your study time.
            </p>

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
                  <label className="form-label" htmlFor="summarizer-subject" style={{ fontSize: '0.75rem' }}>Subject Category *</label>
                  <select 
                    id="summarizer-subject"
                    className="form-input" 
                    value={selectedSubject} 
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    style={{ background: 'var(--bg-input)', fontSize: '0.8rem', height: '38px', padding: '8px 12px' }}
                    required
                  >
                    {subjects.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Summary Goal Selection: Recommended/Default is Time Management */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Summarization Goal</label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="summaryType" 
                        value="time_management" 
                        checked={summaryType === 'time_management'} 
                        onChange={() => setSummaryType('time_management')} 
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>(Recommended) Time Management Plan & Key Concepts</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="summaryType" 
                        value="general" 
                        checked={summaryType === 'general'} 
                        onChange={() => setSummaryType('general')} 
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>General Notes Summary</span>
                    </label>
                  </div>
                </div>

                {/* File Upload Zone */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Upload Unit Document File (PDF, DOCX, TXT, Image)</label>
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
                  <label className="form-label" htmlFor="summarizer-content" style={{ fontSize: '0.75rem' }}>Or Paste Unit Content</label>
                  <textarea 
                    id="summarizer-content"
                    className="form-input" 
                    placeholder="Paste textbook sections, notes, or paragraphs here..."
                    rows={6}
                    value={form.text}
                    onChange={(e) => setForm(f => ({ ...f, text: e.target.value }))}
                    style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                    required={!formFile}
                  />
                </div>

                {/* Search tags */}
                <div className="form-group">
                  <label className="form-label" htmlFor="summarizer-tags" style={{ fontSize: '0.75rem' }}>Optional Tags (comma separated)</label>
                  <input 
                    id="summarizer-tags"
                    className="form-input" 
                    placeholder="e.g. unit-1, mid-term" 
                    value={form.tags}
                    onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                    style={{ fontSize: '0.8rem', height: '38px', padding: '8px 12px' }}
                  />
                </div>

                <button 
                  type="submit" 
                  className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`} 
                  disabled={loading}
                  style={{ padding: '10px 16px', fontSize: '0.85rem', marginTop: '6px' }}
                >
                  {loading ? 'Analyzing Content...' : '✨ Generate & Save Study Guide'}
                </button>
              </form>
            )}
          </div>

          {/* Live Output Section */}
          {successData && (
            <div className="card animate-fade-in flex-col" style={{ gap: '10px', padding: '16px' }}>
              <div className="flex-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🧠 Generated Study Guide: {successData.subject}
                </span>
                <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>Summarized & Saved</span>
              </div>
              
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {successData.tags.map((t, idx) => (
                  <span key={idx} className="badge badge-purple" style={{ fontSize: '0.6rem' }}>#{t}</span>
                ))}
              </div>

              <div 
                className="markdown-content" 
                style={{ 
                  fontSize: '0.82rem', 
                  color: 'var(--text-secondary)', 
                  lineHeight: '1.5', 
                  whiteSpace: 'pre-wrap', 
                  margin: '8px 0', 
                  overflowX: 'auto',
                  background: 'rgba(0,0,0,0.1)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {successData.summary}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={() => {
                    setActiveTab('study');
                    setSuccessData(null);
                  }}
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  📖 View in Study Tracker
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setSuccessData(null)} 
                  style={{ fontSize: '0.75rem', padding: '6px 12px', color: 'var(--text-muted)' }}
                >
                  Clear Output
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
