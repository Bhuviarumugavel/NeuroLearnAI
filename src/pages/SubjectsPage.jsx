/**
 * SubjectsPage.jsx — Subject Settings Page.
 * Configure subject details (priority, study duration, exam deadlines)
 * and perform manual notes upload.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useData } from '../context/DataContext';

const COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ec4899','#06b6d4','#ef4444'];
const PRIORITIES = ['Low', 'Medium', 'High'];

export default function SubjectsPage() {
  const { subjects, refreshSubjects, refreshNotes, refreshSummary } = useData();

  // Selected active subject
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  
  // Creation form states
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0], priority: 'Medium', deadline: '', daily_study_minutes: 45 });
  const [newSubFile, setNewSubFile] = useState(null);

  // Manual Notes Upload States (for selected subject)
  const [manualText, setManualText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualFile, setManualFile] = useState(null);
  
  const [saving, setSaving] = useState(false);
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

    const hasDescription = form.description && form.description.trim().length > 0;
    const hasFile = !!newSubFile;
    if (!hasDescription && !hasFile) {
      setError('Please provide a notes description/syllabus OR upload a notes file.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/api/subjects', {
        name: form.name,
        description: form.description || 'Subject configured with uploaded notes.',
        color: form.color,
        priority: form.priority,
        deadline: form.deadline || null,
        daily_study_minutes: Number(form.daily_study_minutes)
      });

      let notesContent = form.description ? form.description.trim() : '';

      if (newSubFile) {
        const formData = new FormData();
        formData.append('file', newSubFile);
        formData.append('subject_tag', form.name);
        
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
      await Promise.all([refreshSubjects(), refreshNotes(), refreshSummary()]);
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
      await Promise.all([refreshSubjects(), refreshSummary()]);
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
      await Promise.all([refreshSubjects(), refreshSummary()]);
    } catch (err) {
      setError('Failed to delete subject.');
    }
  };

  const handleManualNotesUpload = async (e) => {
    e.preventDefault();
    if (!activeSub) return;

    if (!manualFile && !manualText.trim()) {
      setError('Please paste study content or upload a file.');
      return;
    }

    setUploadingManual(true);
    setError('');
    setSuccessMsg('');
    try {
      if (manualFile) {
        const formData = new FormData();
        formData.append('file', manualFile);
        formData.append('subject_tag', activeSub.name);
        
        await api.post('/api/notes/upload-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/api/notes', {
          text: manualText,
          subject_tag: activeSub.name
        });
      }
      setSuccessMsg('Study notes uploaded and summarized successfully!');
      setManualText('');
      setManualTitle('');
      setManualFile(null);
      
      // Update global context states (library + dashboard metrics)
      await Promise.all([refreshNotes(), refreshSummary()]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Notes upload failed.');
    } finally {
      setUploadingManual(false);
    }
  };

  const handleManualFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setManualFile(e.target.files[0]);
    }
  };

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
                      onClick={() => { setSelectedSubId(id); setShowForm(false); setError(''); setSuccessMsg(''); }}
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
              
              {/* Subject Metadata Card */}
              <div className="card" style={{ padding: '16px' }}>
                <h2 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  ⚙️ Settings: {activeSub.name}
                </h2>
                
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

              {/* Subject Manual Notes Upload Card */}
              <div className="card" style={{ padding: '16px' }}>
                <h3 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '12px' }}>
                  📝 Upload Study Notes
                </h3>
                
                <form onSubmit={handleManualNotesUpload} className="flex-col" style={{ gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Note Title (optional)</label>
                    <input 
                      className="form-input" 
                      placeholder="e.g. Chapter 1 Notes" 
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Select Document File</label>
                    <input 
                      type="file" 
                      className="form-input" 
                      accept=".txt,.md,.pdf,.docx,image/*"
                      onChange={handleManualFileChange} 
                      style={{ fontSize: '0.8rem', padding: '6px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Or Paste Note Content *</label>
                    <textarea 
                      className="form-input"
                      placeholder="Paste textbook summary or slide transcripts here..."
                      rows={4}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      required={!manualFile}
                      style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className={`btn btn-primary btn-full ${uploadingManual ? 'btn-loading' : ''}`} 
                    disabled={uploadingManual}
                    style={{ fontSize: '0.8rem', padding: '10px' }}
                  >
                    {uploadingManual ? 'Uploading...' : '💾 Upload Study Notes'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="card flex-col flex-center text-muted" style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>📚</div>
              <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Select a subject to configure or upload study guides.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
