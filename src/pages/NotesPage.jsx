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
  const { subjects, notes, plans, refreshNotes, refreshSummary, refreshAll } = useData();
  const { activeSubjectId, secondsElapsed, isActive, startSession, stopSession } = useStudyTimer();

  // Primary page tab: 'study' (Option 1) | 'manual' (Option 2)
  const [activeTab, setActiveTab] = useState('study');

  // AI Notes subject-wise tab selection state
  const [aiSubjectTabId, setAiSubjectTabId] = useState('');

  // Manual / Test Ready summarizer form states
  const [selectedSubject, setSelectedSubject] = useState('');
  const [manualText, setManualText] = useState('');
  const [formFiles, setFormFiles] = useState([]); // Multiple files
  const [manualTopic, setManualTopic] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState('');

  const [customTopicText, setCustomTopicText] = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});

  const activeSub = subjects.find(s => (s._id || s.id) === selectedSubject);
  const activePlan = plans?.find(p => p.subject_name === activeSub?.name);
  const activeTopics = activePlan?.topics || [];

  // Auto-select first subject in dropdowns on load
  useEffect(() => {
    if (subjects.length > 0) {
      if (!selectedSubject) setSelectedSubject(subjects[0]._id || subjects[0].id);
      if (!aiSubjectTabId) setAiSubjectTabId(subjects[0]._id || subjects[0].id);
    }
  }, [subjects, selectedSubject, aiSubjectTabId]);

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
    if (!file) return null;
    const validExtensions = ['.txt', '.md', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp'];
    const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isValid = validExtensions.includes(fileExt) || file.type.startsWith('image/') || file.type === 'application/pdf';
    
    if (!isValid) {
      setError("Unsupported file format (.txt, .md, .pdf, .docx, or images).");
      return null;
    }
    
    setError('');
    return file;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const parsed = Array.from(e.dataTransfer.files).map(parseFile).filter(Boolean);
      setFormFiles(prev => [...prev, ...parsed]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const parsed = Array.from(e.target.files).map(parseFile).filter(Boolean);
      setFormFiles(prev => [...prev, ...parsed]);
    }
  };

  const handleAiGenerate = async (e) => {
    e.preventDefault();
    const activeSub = subjects.find(s => (s._id || s.id) === selectedSubject);
    if (!activeSub) {
      setError('Please add a subject in Subject Settings first.');
      return;
    }
    const subjectName = activeSub.name;
    const finalTopic = customTopicText.trim();

    setLoading(true);
    setError('');
    setSuccessData(null);
    try {
      const res = await api.post('/api/notes/generate-auto', {
        description: finalTopic ? `Notes for topic: ${finalTopic}` : `General study guide notes for subject: ${subjectName}`,
        subject_name: subjectName
      });

      const notesText = res.data.notes || res.data.summary || "Summary generated successfully.";
      setSuccessData({
        summary: notesText,
        subject: subjectName,
        tags: [subjectName, finalTopic || 'General Study'].filter(Boolean)
      });

      // Trigger automatic "Summary Ready" reminder notification
      try {
        await api.post('/api/reminders/trigger', {
          message: `Summary Ready: Study notes for ${subjectName}${finalTopic ? ` on "${finalTopic}"` : ''} are compiled!`,
          remind_at: new Date().toISOString()
        });
      } catch (rErr) {
        console.error("Failed to trigger summary reminder", rErr);
      }

      setCustomTopicText('');
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'AI note generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const triggerGenerateForTodayTopic = async (subject, topicName) => {
    setLoading(true);
    setError('');
    setSuccessData(null);
    try {
      const res = await api.post('/api/notes/generate-auto', {
        description: topicName ? `Notes for topic: ${topicName}` : `General study guide notes for subject: ${subject.name}`,
        subject_name: subject.name
      });

      const notesText = res.data.notes || res.data.summary || "Summary generated successfully.";
      setSuccessData({
        summary: notesText,
        subject: subject.name,
        tags: [subject.name, topicName || 'General Study'].filter(Boolean)
      });

      // Trigger automatic "Summary Ready" reminder notification
      try {
        await api.post('/api/reminders/trigger', {
          message: `Summary Ready: Study notes for ${subject.name}${topicName ? ` on "${topicName}"` : ''} are compiled!`,
          remind_at: new Date().toISOString()
        });
      } catch (rErr) {
        console.error("Failed to trigger summary reminder", rErr);
      }

      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'AI note generation failed.');
    } finally {
      setLoading(false);
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

    const hasText = manualText.trim().length > 0;
    const hasFiles = formFiles.length > 0;

    if (!hasText && !hasFiles) {
      setError('Please select one or more files to upload or paste raw notes content.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessData(null);

    try {
      let filesToUpload = [...formFiles];
      if (hasText) {
        const textBlob = new Blob([manualText], { type: 'text/plain' });
        const textFile = new File([textBlob], `${manualTopic || 'Raw_Notes'}.txt`, { type: 'text/plain' });
        filesToUpload.push(textFile);
      }

      let lastSummary = "";
      // Upload each file sequentially
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('subject_tag', subjectTag);
        formData.append('upload_source', 'manual_summarizer');
        formData.append('summary_type', 'general');
        formData.append('topic', manualTopic);

        const uploadRes = await api.post('/api/notes/upload-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        lastSummary = uploadRes.data.summary || lastSummary;
      }

      setSuccessData({
        summary: lastSummary || "Summary generated successfully.",
        subject: subjectTag,
        tags: [subjectTag, manualTopic || 'Test Ready Summary'].filter(Boolean)
      });

      // Trigger automatic "Upload Success" and "Summary Ready" reminder notification
      try {
        await api.post('/api/reminders/trigger', {
          message: `Upload Success: Test Ready notes compiled for "${subjectTag}"!`,
          remind_at: new Date().toISOString()
        });
      } catch (rErr) {
        console.error("Failed to trigger upload reminder", rErr);
      }

      setManualText('');
      setManualTopic('');
      setFormFiles([]);
      await refreshAll();
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
      await refreshAll();
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
          onClick={() => {
            setActiveTab('study');
            setSuccessData(null);
          }}
          style={{ flex: 1, fontSize: '0.8rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          📚 AI Notes
        </button>
        <button 
          className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            setActiveTab('manual');
            setSuccessData(null);
          }}
          style={{ flex: 1, fontSize: '0.8rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          ⚡ Test Ready Notes
        </button>
      </div>

      {/* OPTION 1: AI Notes (Subject wise tabs) */}
      {activeTab === 'study' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {subjects.length === 0 ? (
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Add a subject category first in settings.</p>
              <Link to="/subjects" className="btn btn-primary btn-sm mt-8">Configure Subjects</Link>
            </div>
          ) : (
            <>
              {/* Subject-wise tabs selector row */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                {subjects.map(s => {
                  const isSelected = (s._id || s.id) === aiSubjectTabId;
                  return (
                    <button
                      key={s._id || s.id}
                      onClick={() => {
                        setAiSubjectTabId(s._id || s.id);
                        setSuccessData(null);
                        setError('');
                      }}
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                      style={{
                        fontSize: '0.75rem',
                        padding: '6px 12px',
                        whiteSpace: 'nowrap',
                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                        borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                        color: isSelected ? '#fff' : 'var(--text-primary)'
                      }}
                    >
                      📚 {s.name}
                    </button>
                  );
                })}
              </div>

              {error && <div className="auth-error text-xs mb-16">{error}</div>}

              {/* Render Selected Subject Details */}
              {(() => {
                const activeAiSub = subjects.find(s => (s._id || s.id) === aiSubjectTabId);
                if (!activeAiSub) return null;

                const todayTopic = getTodayTopicForSubject(activeAiSub.name);
                // Search auto-generated notes matching this subject and description containing today's topic
                const todayTopicNotes = todayTopic 
                  ? notes.find(n => n.type === 'auto_generated' && n.subject?.toLowerCase() === activeAiSub.name.toLowerCase() && n.description?.toLowerCase().includes(todayTopic.name.toLowerCase()))
                  : null;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {todayTopicNotes ? (
                      <div className="card" style={{ padding: '16px' }}>
                        <div className="flex-between mb-12" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                            📖 Today's Topic Focus: <span style={{ color: 'var(--accent-light)' }}>{todayTopic?.name}</span>
                          </h3>
                          <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>AI Study Guide</span>
                        </div>
                        
                        {/* Live Timer Integration */}
                        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>⏱️ Focus Time Tracker</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Target duration: {todayTopic?.duration} mins</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isActive && activeSubjectId === activeAiSub._id ? (
                              <>
                                <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                                  Active: {formatFocusTime(secondsElapsed)}
                                </span>
                                <button onClick={stopSession} className="btn btn-xs" style={{ background: 'var(--text-red)', color: '#fff', fontSize: '0.65rem', padding: '4px 8px' }}>Stop</button>
                              </>
                            ) : (
                              <button onClick={() => startSession(activeAiSub._id, activeAiSub.name)} className="btn btn-xs btn-primary" style={{ fontSize: '0.65rem', padding: '4px 8px' }}>
                                ▶ Start Focus
                              </button>
                            )}
                          </div>
                        </div>

                        <div 
                          className="markdown-content" 
                          style={{ 
                            fontSize: '0.82rem', 
                            color: 'var(--text-secondary)', 
                            lineHeight: '1.5', 
                            whiteSpace: 'pre-wrap', 
                            maxHeight: '380px',
                            overflowY: 'auto',
                            background: 'rgba(0,0,0,0.1)',
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          {todayTopicNotes.summary || todayTopicNotes.original_text || todayTopicNotes.generated_notes}
                        </div>
                      </div>
                    ) : todayTopic ? (
                      <div className="card" style={{ padding: '24px 16px', textAlign: 'center', border: '1.5px dashed var(--border-subtle)', background: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🤖</div>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '6px' }}>Today's scheduled topic: <span style={{ color: 'var(--accent-light)' }}>{todayTopic.name}</span></h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '400px', margin: '0 auto 16px' }}>
                          Revision is scheduled for this topic today in the Calendar. Generate notes now to start your study guide session.
                        </p>
                        <button
                          onClick={() => triggerGenerateForTodayTopic(activeAiSub, todayTopic.name)}
                          className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
                          disabled={loading}
                          style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                        >
                          {loading ? '🤖 AI is gathering notes...' : '✨ Generate AI Notes Summary'}
                        </button>
                      </div>
                    ) : (
                      <div className="card" style={{ padding: '24px 16px', textAlign: 'center', border: '1.5px dashed var(--border-subtle)', background: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '6px' }}>No Calendar Topics Scheduled</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '400px', margin: '0 auto 16px' }}>
                          There is no day-wise revision topic currently scheduled for today in the Study Calendar.
                        </p>
                        <button
                          onClick={() => triggerGenerateForTodayTopic(activeAiSub, '')}
                          className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
                          disabled={loading}
                          style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                        >
                          {loading ? '🤖 AI is gathering notes...' : '✨ Generate General AI Notes'}
                        </button>
                      </div>
                    )}

                    {/* Subject Study Guides History */}
                    <div className="card" style={{ padding: '16px' }}>
                      <h3 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '12px' }}>
                        ✨ Notes History for {activeAiSub.name} ({notes.filter(n => n.type === 'auto_generated' && n.subject?.toLowerCase() === activeAiSub.name.toLowerCase()).length})
                      </h3>
                      {notes.filter(n => n.type === 'auto_generated' && n.subject?.toLowerCase() === activeAiSub.name.toLowerCase()).length === 0 ? (
                        <p className="text-muted text-xs">No AI-generated notes yet for this subject.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {notes.filter(n => n.type === 'auto_generated' && n.subject?.toLowerCase() === activeAiSub.name.toLowerCase()).map((note) => {
                            const id = note._id || note.id;
                            const isExpanded = !!expandedNotes[id];
                            return (
                              <div key={id} style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                <div className="flex-between">
                                  <div>
                                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                      {note.description || 'General Notes'}
                                    </strong>
                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                      {new Date(note.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button 
                                      type="button"
                                      className="btn btn-ghost btn-xs" 
                                      onClick={() => toggleExpandNote(id)}
                                      style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                    >
                                      {isExpanded ? 'Hide' : 'Read'}
                                    </button>
                                    <button 
                                      type="button"
                                      className="btn btn-ghost btn-xs" 
                                      onClick={(e) => handleDeleteNote(id, e)}
                                      style={{ fontSize: '0.7rem', padding: '2px 6px', color: 'var(--text-red)' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                                
                                {isExpanded && (
                                  <div 
                                    className="markdown-content" 
                                    style={{ 
                                      fontSize: '0.78rem', 
                                      color: 'var(--text-secondary)', 
                                      lineHeight: '1.4', 
                                      marginTop: '8px', 
                                      borderTop: '1px solid var(--border-subtle)', 
                                      paddingTop: '8px',
                                      whiteSpace: 'pre-wrap'
                                    }}
                                  >
                                    {note.summary || note.generated_notes || 'No content.'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* OPTION 2: Test Ready Notes (Pasted Raw Notes & Uploads) */}
      {activeTab === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="card" style={{ padding: '16px' }}>
            <h2 className="section-title" style={{ fontSize: '1rem', marginBottom: '4px' }}>⚡ Test Ready Notes</h2>
            <p className="page-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Paste raw notes or upload study documents along with a topic name to generate a highly simplified and accurate summary ready for tests.
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

                {/* Topic Name */}
                <div className="form-group">
                  <label className="form-label" htmlFor="summarizer-topic" style={{ fontSize: '0.75rem' }}>Topic Name *</label>
                  <input 
                    id="summarizer-topic"
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Synaptic Plasticity, Basic Anatomy"
                    value={manualTopic}
                    onChange={(e) => setManualTopic(e.target.value)}
                    style={{ fontSize: '0.8rem', height: '38px', padding: '8px 12px' }}
                    required
                  />
                </div>

                {/* Paste Raw Notes */}
                <div className="form-group">
                  <label className="form-label" htmlFor="summarizer-rawtext" style={{ fontSize: '0.75rem' }}>Paste Raw Notes / Material *</label>
                  <textarea 
                    id="summarizer-rawtext"
                    className="form-input" 
                    placeholder="Paste raw text, paragraphs, or book extracts here to summarize them accurately and simply..."
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    style={{ fontSize: '0.8rem', minHeight: '120px', padding: '10px 12px', fontFamily: 'Inter, sans-serif' }}
                  />
                </div>

                {/* File Upload Zone */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Or Upload Notes Documents (PDF, DOCX, PPT, Image)</label>
                  <div 
                    className={`flex-col flex-center ${dragActive ? 'drag-active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    style={{
                      border: '1.5px dashed var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '20px 14px',
                      textAlign: 'center',
                      background: dragActive ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-input)',
                      cursor: 'pointer'
                    }}
                    onClick={() => document.getElementById('file-upload-input').click()}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>📁</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {formFiles.length > 0 ? `Selected ${formFiles.length} file(s): ${formFiles.map(f => f.name).join(', ')}` : 'Drag files here or click to browse'}
                    </div>
                    <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                      Supported: PDF, Word (.docx), PowerPoint, Text, and Images
                    </p>
                    <input 
                      id="file-upload-input" 
                      type="file" 
                      multiple
                      accept=".txt,.md,.pdf,.docx,.doc,.ppt,.pptx,image/*"
                      onChange={handleFileChange} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`} 
                  disabled={loading}
                  style={{ padding: '10px 16px', fontSize: '0.85rem', marginTop: '6px' }}
                >
                  {loading ? '🧠 Generating Test Ready summary...' : '✨ Generate & Save Test Ready Notes'}
                </button>
              </form>
            )}
          </div>

          {/* Live Output Section */}
          {successData && (
            <div className="card animate-fade-in flex-col" style={{ gap: '10px', padding: '16px' }}>
              <div className="flex-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🧠 Test Ready Study Guide: {successData.subject}
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
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setSuccessData(null)} 
                  style={{ fontSize: '0.75rem', padding: '6px 12px', color: 'var(--text-muted)' }}
                >
                  Clear Output
                </button>
              </div>
            </div>
          )}

          {/* Manual Summaries History */}
          <div className="card" style={{ padding: '16px', marginTop: '16px' }}>
            <h3 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '12px' }}>
              📝 Test Ready Notes History ({notes.filter(n => n.type !== 'auto_generated').length})
            </h3>
            {notes.filter(n => n.type !== 'auto_generated').length === 0 ? (
              <p className="text-muted text-xs">No Test Ready notes yet. Use the form above to compile your first test summary.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notes.filter(n => n.type !== 'auto_generated').map((note) => {
                  const id = note._id || note.id;
                  const isExpanded = !!expandedNotes[id];
                  return (
                    <div key={id} style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex-between">
                        <div>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            {note.subject || 'General Notes'}
                          </strong>
                          {note.description && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--accent-light)', marginLeft: '8px' }}>
                              🏷️ {note.description}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            type="button"
                            className="btn btn-ghost btn-xs" 
                            onClick={() => toggleExpandNote(id)}
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                          >
                            {isExpanded ? 'Hide' : 'Read'}
                          </button>
                          <button 
                            type="button"
                            className="btn btn-ghost btn-xs" 
                            onClick={(e) => handleDeleteNote(id, e)}
                            style={{ fontSize: '0.7rem', padding: '2px 6px', color: 'var(--text-red)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div 
                          className="markdown-content" 
                          style={{ 
                            fontSize: '0.78rem', 
                            color: 'var(--text-secondary)', 
                            lineHeight: '1.4', 
                            marginTop: '8px', 
                            borderTop: '1px solid var(--border-subtle)', 
                            paddingTop: '8px',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {note.summary || note.generated_notes || 'No content.'}
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
}
