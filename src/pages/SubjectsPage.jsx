
/**
 * SubjectsPage.jsx — Subject Settings Page.
 * Configure subject details (priority, study duration, exam deadlines)
 * and perform manual notes upload.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useData } from '../context/DataContext';

const COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ec4899','#06b6d4','#ef4444'];
const PRIORITIES = ['Low', 'Medium', 'High'];

export default function SubjectsPage() {
  const { subjects, notes, refreshSubjects, refreshNotes, refreshSummary, plans, refreshAll } = useData();

  // Selected active subject
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  
  // Creation form states
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0], priority: 'Medium', deadline: '', daily_study_minutes: 45 });
  const [newSubFile, setNewSubFile] = useState(null);

  // Manual Notes Upload States (for selected subject)
  const [manualText, setManualText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualFiles, setManualFiles] = useState([]); // Array for multiple files
  const [manualUnit, setManualUnit] = useState('');
  const [manualSyllabus, setManualSyllabus] = useState('');
  const [manualTopic, setManualTopic] = useState('');
  const [manualBook, setManualBook] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [uploadingManual, setUploadingManual] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state for editing an existing subject
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    color: COLORS[0],
    priority: 'Medium',
    deadline: '',
    daily_study_minutes: 45
  });

  const activeSub = subjects.find(s => (s._id || s.id) === selectedSubId);

  // Sync editForm state when activeSub changes
  useEffect(() => {
    if (activeSub) {
      setEditForm({
        name: activeSub.name || '',
        description: activeSub.description || '',
        color: activeSub.color || COLORS[0],
        priority: activeSub.priority || 'Medium',
        deadline: activeSub.deadline || '',
        daily_study_minutes: activeSub.daily_study_minutes || 45
      });
    }
  }, [selectedSubId, activeSub]);

  // Auto-select first subject in list on load
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubId) {
      setSelectedSubId(subjects[0]._id || subjects[0].id);
    }
  }, [subjects, selectedSubId]);

  const handleNewSubFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewSubFile(file);
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (!form.description || !form.description.trim()) {
      setError('Description / Syllabus is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/api/subjects', {
        name: form.name,
        description: form.description.trim(),
        color: form.color,
        priority: form.priority,
        deadline: form.deadline || null,
        daily_study_minutes: Number(form.daily_study_minutes)
      });

      let notesContent = form.description.trim();

      if (newSubFile) {
        const formData = new FormData();
        formData.append('file', newSubFile);
        formData.append('subject_tag', form.name);
        formData.append('upload_source', 'subject_settings');
        formData.append('summary_type', 'general');
        
        const uploadRes = await api.post('/api/notes/upload-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        notesContent = uploadRes.data.original_text || uploadRes.data.summary || notesContent;
      }

      // Automatically generate a study plan & AI summary notes in the background
      const planDeadline = form.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const planDesc = notesContent || `Learning schedule for ${form.name}`;

      await Promise.all([
        api.post('/api/study-plans/generate', {
          description: planDesc,
          subject_name: form.name,
          deadline: planDeadline,
          daily_minutes: Number(form.daily_study_minutes) || 45
        }).catch(err => console.error("Auto study plan generation failed", err)),

        api.post('/api/notes/generate-auto', {
          description: planDesc,
          subject_name: form.name
        }).catch(err => console.error("Auto notes generation failed", err))
      ]);

      setForm({ name: '', description: '', color: COLORS[0], priority: 'Medium', deadline: '', daily_study_minutes: 45 });
      setNewSubFile(null);
      setShowForm(false);

      if (res.data.subject?._id) {
        setSelectedSubId(res.data.subject._id);
      }

      setSuccessMsg('Subject configured successfully!');
      // Update global contexts
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSubject = async (e) => {
    e.preventDefault();
    if (!activeSub) return;

    if (!editForm.description || !editForm.description.trim()) {
      setError('Description is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.put(`/api/subjects/${selectedSubId}`, {
        name: editForm.name,
        description: editForm.description,
        color: editForm.color,
        priority: editForm.priority,
        deadline: editForm.deadline || null,
        daily_study_minutes: Number(editForm.daily_study_minutes)
      });
      setSuccessMsg('Settings updated successfully!');
      await refreshAll();
    } catch (err) {
      setError('Failed to update subject settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm('Delete subject settings permanently?')) return;
    try {
      await api.delete(`/api/subjects/${id}`);
      setSelectedSubId(null);
      await refreshAll();
    } catch (err) {
      setError('Failed to delete subject.');
    }
  };

  const handleManualNotesUpload = async (e) => {
    e.preventDefault();
    if (!activeSub) return;

    const hasFiles = manualFiles.length > 0;
    if (!hasFiles && !manualText.trim()) {
      setError('Please paste study content or select one or more files.');
      return;
    }

    setUploadingManual(true);
    setError('');
    setSuccessMsg('');
    try {
      if (hasFiles) {
        // Upload each file sequentially
        for (const file of manualFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('subject_tag', activeSub.name);
          formData.append('upload_source', 'subject_settings');
          formData.append('summary_type', 'general');

          await api.post('/api/notes/upload-file', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      } else {
        await api.post('/api/notes', {
          text: manualText,
          subject_tag: activeSub.name,
          upload_source: 'subject_settings',
          summary_type: 'general'
        });
      }
      
      setSuccessMsg(`Successfully uploaded and saved notes for "${activeSub.name}" to the Library!`);
      
      // Trigger automatic "Upload Success" reminder notification
      try {
        await api.post('/api/reminders/trigger', {
          message: `Upload Success: Notes uploaded to Subject "${activeSub.name}"!`,
          remind_at: new Date().toISOString()
        });
      } catch (rErr) {
        console.error("Failed to trigger upload reminder", rErr);
      }

      setManualText('');
      setManualFiles([]);
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Notes upload failed.');
    } finally {
      setUploadingManual(false);
    }
  };

  const handleManualFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setManualFiles(Array.from(e.target.files));
    }
  };

  const activePlan = plans?.find(p => p.subject_name === activeSub?.name);
  const activeTopics = activePlan?.topics || [];

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem' }}>⚙️ Subject Settings</h1>
        </div>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={() => { setShowForm(!showForm); if(!showForm) setSelectedSubId(null); }}
          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
        >
          {showForm ? '✕ Cancel' : '+ Subject'}
        </button>
      </div>

      {error && <div className="auth-error text-xs mb-16">{error}</div>}
      {successMsg && <div className="badge badge-green text-xs mb-16" style={{ width: '100%', padding: '10px' }}>{successMsg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Left Side: Subjects List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Create Form */}
          {showForm && (
            <div className="card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>New Subject</h3>
              <form onSubmit={handleCreateSubject} className="flex-col" style={{ gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Subject Name *</label>
                  <input className="form-input" placeholder="e.g. Mathematics II" value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Description of the Notes / Syllabus</label>
                  <textarea 
                    className="form-input" 
                    placeholder="Topics, outline, or key details..." 
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Or Upload Notes File</label>
                  <input 
                    type="file" 
                    className="form-input" 
                    accept=".txt,.md,.pdf,.docx,image/*"
                    onChange={handleNewSubFileChange} 
                    style={{ fontSize: '0.8rem', padding: '6px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Priority</label>
                  <select 
                    className="form-input" 
                    value={form.priority}
                    onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                    style={{ background: 'var(--bg-input)', fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Exam Date / Deadline</label>
                  <input type="date" className="form-input" value={form.deadline}
                    onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))} style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Preferred Focus Duration (Mins)</label>
                  <input type="number" className="form-input" min={5} value={form.daily_study_minutes}
                    onChange={(e) => setForm(f => ({ ...f, daily_study_minutes: e.target.value }))} style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Theme Color</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: form.color === c ? '2px solid #fff' : '1px solid transparent', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
                <button type="submit" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving} style={{ fontSize: '0.8rem', padding: '10px' }}>
                  {saving ? 'Creating…' : 'Create Subject'}
                </button>
              </form>
            </div>
          )}

          {/* List of existing subjects */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '8px' }}>📚 Your Subjects</h3>
            {subjects.length === 0 ? (
              <p className="text-muted text-xs">No subjects added yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {subjects.map(s => {
                  const id = s._id || s.id;
                  const isSelected = selectedSubId === id;
                  return (
                    <div 
                      key={id}
                      onClick={() => { setSelectedSubId(id); setShowForm(false); setIsEditingSettings(false); setError(''); setSuccessMsg(''); }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-input)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.78rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color || 'var(--accent-primary)' }}></span>
                        {s.name}
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteSubject(id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Subject Details & Workspaces */}
        <div>
          {activeSub ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Subject Details Panel (Read-Only by default) */}
              {!isEditingSettings ? (
                <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="flex-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: activeSub.color || 'var(--accent-primary)' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeSub.color || 'var(--accent-primary)' }}></span>
                      {activeSub.name}
                    </h2>
                    <button 
                      className="btn btn-outline btn-xs" 
                      onClick={() => setIsEditingSettings(true)}
                      style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                    >
                      ⚙️ Edit Settings
                    </button>
                  </div>

                  {/* Badges Row */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>🔥 {activeSub.priority} Priority</span>
                    {activeSub.deadline && (
                      <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>📅 Exam: {activeSub.deadline}</span>
                    )}
                    <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>⏱️ Focus: {activeSub.daily_study_minutes} mins/day</span>
                  </div>

                  {/* Description Section */}
                  <div>
                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.5px' }}>Description / Syllabus</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {activeSub.description}
                    </p>
                  </div>

                  {/* Uploaded notes / resources list */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                      Library Resources ({notes.filter(n => n.subject?.toLowerCase() === activeSub.name.toLowerCase()).length})
                    </h4>
                    
                    {notes.filter(n => n.subject?.toLowerCase() === activeSub.name.toLowerCase()).length === 0 ? (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                        No notes or documents uploaded yet for this subject. Use the form below to upload notes.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                        {notes.filter(n => n.subject?.toLowerCase() === activeSub.name.toLowerCase()).map((note) => {
                          const noteId = note._id || note.id;
                          const isFile = !!note.file_name;
                          return (
                            <div 
                              key={noteId} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: 'var(--bg-input)', 
                                padding: '8px 10px', 
                                borderRadius: '6px', 
                                border: '1px solid var(--border-subtle)' 
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '8px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {isFile ? `📁 ${note.file_name}` : '📝 AI Notes Summary'}
                                </span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                  Type: {note.type === 'auto_generated' ? 'Auto Notes' : 'Manual Upload'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <Link 
                                  to="/library"
                                  className="btn btn-ghost btn-xs"
                                  style={{ fontSize: '0.65rem', padding: '4px 6px', height: 'auto' }}
                                >
                                  Read
                                </Link>
                                {isFile && (
                                  <a 
                                    href={`${api.defaults.baseURL || ''}/api/notes/${noteId}/download`}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-outline btn-xs"
                                    style={{ fontSize: '0.65rem', padding: '4px 6px', height: 'auto' }}
                                  >
                                    Download
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add Notes Section */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '4px' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ➕ Add Study Notes to Library
                    </h3>
                    
                    <form onSubmit={handleManualNotesUpload} className="flex-col" style={{ gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>Upload Document Files</label>
                        <input 
                          type="file" 
                          multiple
                          className="form-input" 
                          accept=".txt,.md,.pdf,.docx,.doc,.ppt,.pptx,image/*"
                          onChange={handleManualFileChange} 
                          style={{ fontSize: '0.75rem', padding: '6px', background: 'var(--bg-input)' }}
                        />
                        {manualFiles.length > 0 && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--accent-light)', marginTop: '2px' }}>
                            Selected {manualFiles.length} file(s): {manualFiles.map(f => f.name).join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>Or Paste Study Text Notes</label>
                        <textarea 
                          className="form-input"
                          placeholder="Paste notes content or outlines here..."
                          rows={3}
                          value={manualText}
                          onChange={(e) => setManualText(e.target.value)}
                          required={manualFiles.length === 0}
                          style={{ fontSize: '0.75rem', padding: '8px 12px' }}
                        />
                      </div>

                      <button 
                        type="submit" 
                        className={`btn btn-primary btn-sm btn-full ${uploadingManual ? 'btn-loading' : ''}`} 
                        disabled={uploadingManual}
                        style={{ fontSize: '0.78rem', padding: '8px' }}
                      >
                        {uploadingManual ? 'Uploading...' : '💾 Add Notes to Library'}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                /* Subject Settings Form (When isEditingSettings is true) */
                <div className="card" style={{ padding: '16px' }}>
                  <div className="flex-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '12px' }}>
                    <h2 className="section-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                      ⚙️ Edit Settings: {activeSub.name}
                    </h2>
                    <button 
                      className="btn btn-ghost btn-xs" 
                      onClick={() => setIsEditingSettings(false)}
                      style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <form onSubmit={handleUpdateSubject} className="flex-col" style={{ gap: '10px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem' }}>Subject Name</label>
                      <input 
                        className="form-input" 
                        value={editForm.name} 
                        onChange={(e) => {
                          setEditForm(prev => ({ ...prev, name: e.target.value }));
                        }} 
                        required 
                        disabled
                        style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px', opacity: 0.8 }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem' }}>Description / Syllabus *</label>
                      <textarea 
                        className="form-input" 
                        value={editForm.description} 
                        onChange={(e) => {
                          setEditForm(prev => ({ ...prev, description: e.target.value }));
                        }} 
                        rows={3}
                        required
                        style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem' }}>Priority Level</label>
                      <select 
                        className="form-input"
                        value={editForm.priority}
                        onChange={(e) => {
                          setEditForm(prev => ({ ...prev, priority: e.target.value }));
                        }}
                        style={{ background: 'var(--bg-input)', fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                      >
                        {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem' }}>Exam Date / Deadline</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={editForm.deadline} 
                        onChange={(e) => {
                          setEditForm(prev => ({ ...prev, deadline: e.target.value }));
                        }} 
                        style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem' }}>Preferred Focus Duration (Mins)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        min={5} 
                        value={editForm.daily_study_minutes} 
                        onChange={(e) => {
                          setEditForm(prev => ({ ...prev, daily_study_minutes: Number(e.target.value) }));
                        }} 
                        style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem' }}>Theme Color</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {COLORS.map((c) => (
                          <button 
                            key={c} 
                            type="button" 
                            onClick={() => {
                              setEditForm(prev => ({ ...prev, color: c }));
                            }}
                            style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: editForm.color === c ? '2px solid #fff' : '1px solid transparent', cursor: 'pointer' }} 
                          />
                        ))}
                      </div>
                    </div>

                    <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving} style={{ fontSize: '0.8rem', padding: '10px' }}>
                      {saving ? 'Saving...' : '💾 Save Settings'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="card flex-col flex-center text-muted" style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>📚</div>
              <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Select a subject to view details or add notes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
