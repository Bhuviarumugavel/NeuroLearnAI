/**
 * SubjectsPage.jsx — Subject Settings Page
 * Manage subjects, priorities, deadlines, and launch AI study content generation.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

const COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ec4899','#06b6d4','#ef4444'];
const PRIORITIES = ['Low', 'Medium', 'High'];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Forms & Selections
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0], priority: 'Medium', deadline: '', daily_study_minutes: 45 });
  const [saving, setSaving] = useState(false);

  // Detail panel tabs: 'config' | 'ai' | 'manual'
  const [activeTab, setActiveTab] = useState('config');

  // AI & Manual note states
  const [aiDesc, setAiDesc] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [uploadingManual, setUploadingManual] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadSubjects = async () => {
    try {
      const res = await api.get('/api/subjects');
      const list = res.data.subjects || [];
      setSubjects(list);
      
      // If we had a selected subject, re-select it to update data
      if (selectedSubId) {
        const found = list.find(s => (s._id || s.id) === selectedSubId);
        if (!found && list.length > 0) setSelectedSubId(list[0]._id || list[0].id);
      } else if (list.length > 0) {
        setSelectedSubId(list[0]._id || list[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/api/subjects', {
        name: form.name,
        description: form.description,
        color: form.color,
        priority: form.priority,
        deadline: form.deadline || null,
        daily_study_minutes: Number(form.daily_study_minutes)
      });
      setForm({ name: '', description: '', color: COLORS[0], priority: 'Medium', deadline: '', daily_study_minutes: 45 });
      setShowForm(false);
      
      // Select the newly created subject
      if (res.data.subject?._id) {
        setSelectedSubId(res.data.subject._id);
      }
      await loadSubjects();
    } catch (err) {
      setError('Failed to create subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSubject = async (e) => {
    e.preventDefault();
    const activeSub = subjects.find(s => (s._id || s.id) === selectedSubId);
    if (!activeSub) return;

    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.put(`/api/subjects/${selectedSubId}`, {
        name: activeSub.name,
        description: activeSub.description,
        color: activeSub.color,
        priority: activeSub.priority,
        deadline: activeSub.deadline,
        daily_study_minutes: Number(activeSub.daily_study_minutes)
      });
      setSuccessMsg('Subject settings updated successfully!');
      loadSubjects();
    } catch (err) {
      setError('Failed to update subject settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subject? All notes, study materials and quiz historical statuses associated with it will remain, but the subject config will be deleted.')) return;
    try {
      await api.delete(`/api/subjects/${id}`);
      setSelectedSubId(null);
      loadSubjects();
    } catch (err) {
      setError('Failed to delete subject.');
    }
  };

  const handleGenerateAiNotes = async (e) => {
    e.preventDefault();
    const activeSub = subjects.find(s => (s._id || s.id) === selectedSubId);
    if (!activeSub || !aiDesc.trim()) return;

    setGeneratingAi(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/api/notes/generate-auto', {
        description: aiDesc,
        subject_name: activeSub.name
      });
      setSuccessMsg('AI study notes generated and stored in Study Library!');
      setAiDesc('');
    } catch (err) {
      setError('AI notes generation failed. Please try again.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleManualNotesUpload = async (e) => {
    e.preventDefault();
    const activeSub = subjects.find(s => (s._id || s.id) === selectedSubId);
    if (!activeSub || !manualText.trim()) return;

    setUploadingManual(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/api/notes', {
        text: manualText,
        subject_tag: activeSub.name
      });
      setSuccessMsg('Study notes uploaded and summarized successfully!');
      setManualText('');
      setManualTitle('');
    } catch (err) {
      setError('Notes upload failed.');
    } finally {
      setUploadingManual(false);
    }
  };

  const activeSub = subjects.find(s => (s._id || s.id) === selectedSubId);

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">⚙️ Subject Settings</h1>
          <p className="page-subtitle">Configure priority targets, deadlines, and upload/generate learning contents</p>
        </div>
        <button 
          id="add-subject-btn"
          className="btn btn-primary" 
          onClick={() => { setShowForm(!showForm); if(!showForm) setSelectedSubId(null); }}
        >
          {showForm ? '✕ Cancel' : '+ Add Subject'}
        </button>
      </div>

      {error && <div className="auth-error mb-16">{error}</div>}
      {successMsg && <div className="badge badge-green mb-16" style={{ width: '100%', padding: '12px', fontSize: '0.88rem' }}>{successMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Subjects List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* New Subject Form (Takes priority over list) */}
          {showForm && (
            <div className="card animate-slide-up">
              <h3 style={{ marginBottom: '16px' }}>New Subject</h3>
              <form onSubmit={handleCreateSubject} id="subject-form" className="flex-col">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-sub-name">Subject Name *</label>
                  <input id="new-sub-name" className="form-input" placeholder="e.g. Mathematics II" value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-sub-desc">Description</label>
                  <input id="new-sub-desc" className="form-input" placeholder="Brief description…" value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-sub-priority">Priority Level</label>
                  <select 
                    id="new-sub-priority"
                    className="form-input" 
                    value={form.priority}
                    onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-sub-deadline">Exam Date / Deadline</label>
                  <input id="new-sub-deadline" type="date" className="form-input" value={form.deadline}
                    onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-sub-duration">Preferred Focus Duration (Mins)</label>
                  <input id="new-sub-duration" type="number" className="form-input" min={5} value={form.daily_study_minutes}
                    onChange={(e) => setForm(f => ({ ...f, daily_study_minutes: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Theme Color</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: form.color === c ? `2px solid ${c}` : 'none', transition: 'all 0.2s' }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" id="save-subject-btn" className={`btn btn-primary btn-full ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                    {saving ? 'Creating…' : 'Create Subject'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of existing subjects */}
          <div className="card">
            <h3 className="section-title">📚 Your Subjects</h3>
            {loading ? (
              <span className="spinner" style={{ display: 'block', margin: '20px auto' }}></span>
            ) : subjects.length === 0 ? (
              <p className="text-muted text-sm">No subjects added yet. Add one above to configure.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {subjects.map(s => {
                  const id = s._id || s.id;
                  const isSelected = selectedSubId === id;
                  return (
                    <div 
                      key={id}
                      onClick={() => { setSelectedSubId(id); setShowForm(false); setError(''); setSuccessMsg(''); }}
                      style={{
                        padding: '12px 16px',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color || 'var(--accent-primary)' }}></span>
                        {s.name}
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteSubject(id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
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
            <div className="card">
              <div className="flex-between mb-16" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: activeSub.color || 'var(--accent-primary)' }}></span>
                  {activeSub.name} Settings
                </h2>
                <span className="badge badge-purple">{activeSub.priority} Priority</span>
              </div>

              {/* Tab Navigation */}
              <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '20px' }}>
                <button 
                  className={`btn btn-sm ${activeTab === 'config' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setActiveTab('config'); setError(''); setSuccessMsg(''); }}
                >
                  ⚙️ Metadata Settings
                </button>
                <button 
                  className={`btn btn-sm ${activeTab === 'ai' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setActiveTab('ai'); setError(''); setSuccessMsg(''); }}
                >
                  ✨ AI-Assisted Notes
                </button>
                <button 
                  className={`btn btn-sm ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setActiveTab('manual'); setError(''); setSuccessMsg(''); }}
                >
                  📝 Manual Notes Upload
                </button>
              </div>

              {/* Tab Content 1: Configuration Fields */}
              {activeTab === 'config' && (
                <form onSubmit={handleUpdateSubject} className="flex-col">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-sub-name">Subject Name</label>
                    <input 
                      id="edit-sub-name"
                      className="form-input" 
                      value={activeSub.name} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjects(p => p.map(s => (s._id || s.id) === selectedSubId ? { ...s, name: val } : s));
                      }} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-sub-desc">Description</label>
                    <input 
                      id="edit-sub-desc"
                      className="form-input" 
                      value={activeSub.description || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjects(p => p.map(s => (s._id || s.id) === selectedSubId ? { ...s, description: val } : s));
                      }} 
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-sub-priority">Priority Level</label>
                      <select 
                        id="edit-sub-priority"
                        className="form-input"
                        value={activeSub.priority || 'Medium'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSubjects(p => p.map(s => (s._id || s.id) === selectedSubId ? { ...s, priority: val } : s));
                        }}
                      >
                        {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-sub-deadline">Exam Date / Deadline</label>
                      <input 
                        id="edit-sub-deadline"
                        type="date" 
                        className="form-input" 
                        value={activeSub.deadline || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setSubjects(p => p.map(s => (s._id || s.id) === selectedSubId ? { ...s, deadline: val } : s));
                        }} 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-sub-duration">Preferred Daily Study Time (Mins)</label>
                    <input 
                      id="edit-sub-duration"
                      type="number" 
                      className="form-input" 
                      min={5} 
                      value={activeSub.daily_study_minutes || 45} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjects(p => p.map(s => (s._id || s.id) === selectedSubId ? { ...s, daily_study_minutes: val } : s));
                      }} 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Color Theme</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {COLORS.map((c) => (
                        <button 
                          key={c} 
                          type="button" 
                          onClick={() => {
                            setSubjects(p => p.map(s => (s._id || s.id) === selectedSubId ? { ...s, color: c } : s));
                          }}
                          style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: activeSub.color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: activeSub.color === c ? `2px solid ${c}` : 'none', transition: 'all 0.2s' }} 
                        />
                      ))}
                    </div>
                  </div>

                  <button type="submit" id="save-settings-btn" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                    {saving ? 'Updating Settings...' : '💾 Save Settings'}
                  </button>
                </form>
              )}

              {/* Tab Content 2: AI Notes Generator */}
              {activeTab === 'ai' && (
                <form onSubmit={handleGenerateAiNotes} className="flex-col">
                  <div style={{ background: 'rgba(124, 58, 237, 0.05)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '6px' }}>✨ AI-Assisted Study Note Generation</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Provide a description of the topics, chapters, or areas you want notes for. Our AI will automatically construct exam-ready structure notes and auto-save them to your Study Library under this subject.
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ai-generation-desc">Subject Description / Topics *</label>
                    <textarea 
                      id="ai-generation-desc"
                      className="form-input"
                      placeholder="e.g. Detailed notes on Newton's Laws of Motion, force diagrams, frictional calculations, and practice exercises..."
                      rows={6}
                      value={aiDesc}
                      onChange={(e) => setAiDesc(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    id="ai-generate-notes-btn"
                    className={`btn btn-primary ${generatingAi ? 'btn-loading' : ''}`} 
                    disabled={generatingAi || !aiDesc.trim()}
                  >
                    {generatingAi ? 'Structuring AI Study Notes...' : '✨ Generate Notes'}
                  </button>
                </form>
              )}

              {/* Tab Content 3: Manual Notes Upload */}
              {activeTab === 'manual' && (
                <form onSubmit={handleManualNotesUpload} className="flex-col">
                  <div className="form-group">
                    <label className="form-label" htmlFor="manual-note-title">Note Title (optional)</label>
                    <input 
                      id="manual-note-title"
                      className="form-input" 
                      placeholder="e.g. Lecture 1 Notes" 
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="manual-note-content">Note Content *</label>
                    <textarea 
                      id="manual-note-content"
                      className="form-input"
                      placeholder="Paste your course notes or lecture slides text content here. AI will summarize them automatically..."
                      rows={8}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    id="manual-upload-btn"
                    className={`btn btn-primary ${uploadingManual ? 'btn-loading' : ''}`} 
                    disabled={uploadingManual || !manualText.trim()}
                  >
                    {uploadingManual ? 'Uploading Study Notes...' : '💾 Upload Study Notes'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="card flex-col flex-center text-muted" style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem' }}>📚</div>
              <h3>No Subject Selected</h3>
              <p style={{ fontSize: '0.85rem' }}>Select a subject on the left panel to configure settings or upload study content, or create a new subject.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
