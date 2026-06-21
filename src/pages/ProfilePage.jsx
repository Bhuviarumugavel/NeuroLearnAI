/**
 * ProfilePage.jsx — Profile Page
 * Stores user name, educational status, availability, and average focus time/daily goal.
 * Used by NeuroLearn AI to personalize recommendations and schedules.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    education_status: user?.study_preferences?.education_status || 'Student',
    availability: user?.study_preferences?.availability || 'Evening',
    daily_goal_minutes: user?.study_preferences?.daily_goal_minutes || 60,
    average_focus_time: user?.study_preferences?.average_focus_time || 25,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getInitials = (name, email) => {
    if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    return (email || 'U')[0].toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.put('/api/auth/profile', {
        full_name: form.full_name,
        education_status: form.education_status,
        availability: form.availability,
        daily_goal_minutes: Number(form.daily_goal_minutes),
        average_focus_time: Number(form.average_focus_time)
      });
      
      // Update global context cache
      updateUser(res.data.user);
      setSuccess('Profile updated successfully! NeuroLearn AI will optimize your recommendations.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container animate-slide-up" style={{ maxWidth: '800px' }}>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">👤 Profile Settings</h1>
        <p className="page-subtitle">Configure your routine, daily availability, and focus durations to personalize study recommendations</p>
      </div>

      {error && <div className="auth-error mb-16">{error}</div>}
      {success && <div className="badge badge-green mb-16" style={{ width: '100%', padding: '12px', fontSize: '0.88rem' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Summary avatar card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="avatar avatar-lg mb-16" style={{ width: '80px', height: '80px', fontSize: '1.8rem' }}>
            {getInitials(user?.full_name, user?.email)}
          </div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{user?.full_name}</h2>
          <p className="text-sm text-muted mb-16">{user?.email}</p>
          
          <div style={{ width: '100%', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span className="text-muted">Education:</span>
              <strong style={{ color: 'var(--accent-light)' }}>{form.education_status}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span className="text-muted">Streak:</span>
              <strong style={{ color: '#f59e0b' }}>🔥 {user?.streak_days || 0} days</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span className="text-muted">Daily Goal:</span>
              <strong>⏱️ {form.daily_goal_minutes} mins</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Edit Form */}
        <div className="card">
          <h3 className="section-title">✏️ Study Profile Configurations</h3>
          
          <form onSubmit={handleSubmit} className="flex-col" id="profile-edit-form">
            {/* Display Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="profile-fullname">Full Name *</label>
              <input 
                id="profile-fullname"
                className="form-input" 
                value={form.full_name}
                onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                required
              />
            </div>

            {/* Educational Status */}
            <div className="form-group">
              <label className="form-label" htmlFor="profile-education">Educational Status</label>
              <select 
                id="profile-education"
                className="form-input" 
                value={form.education_status}
                onChange={(e) => setForm(f => ({ ...f, education_status: e.target.value }))}
              >
                <option value="Student">Student (High School / University)</option>
                <option value="Working Professional">Working Professional</option>
                <option value="Self-Learner">Self-Directed Learner</option>
              </select>
            </div>

            {/* Study Availability */}
            <div className="form-group">
              <label className="form-label" htmlFor="profile-availability">Availability Slot</label>
              <select 
                id="profile-availability"
                className="form-input" 
                value={form.availability}
                onChange={(e) => setForm(f => ({ ...f, availability: e.target.value }))}
              >
                <option value="Morning">Mornings (6 AM - 12 PM)</option>
                <option value="Afternoon">Afternoons (12 PM - 5 PM)</option>
                <option value="Evening">Evenings (5 PM - 10 PM)</option>
                <option value="Night">Night Owl (10 PM - 3 AM)</option>
                <option value="Weekends">Weekends Only</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Daily Goal minutes */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-dailygoal">Daily Study Goal (Mins)</label>
                <input 
                  id="profile-dailygoal"
                  type="number" 
                  className="form-input" 
                  min={5}
                  value={form.daily_goal_minutes}
                  onChange={(e) => setForm(f => ({ ...f, daily_goal_minutes: e.target.value }))}
                />
              </div>

              {/* Focus session duration */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-focustime">Avg Focus Duration (Mins)</label>
                <input 
                  id="profile-focustime"
                  type="number" 
                  className="form-input" 
                  min={5}
                  value={form.average_focus_time}
                  onChange={(e) => setForm(f => ({ ...f, average_focus_time: e.target.value }))}
                />
              </div>
            </div>

            <button type="submit" id="save-profile-btn" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {saving ? 'Saving changes...' : '💾 Save Profile'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
