/**
 * RegisterPage.jsx — New account creation with email/password.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EyeIcon = ({ show }) => show ? (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
) : (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

function StrengthBar({ password }) {
  const getStrength = (pw) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };
  const strength = getStrength(password);
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'var(--accent-red)', 'var(--accent-orange)', 'var(--accent-blue)', 'var(--accent-green)'];

  if (!password) return null;

  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[1,2,3,4].map((i) => (
          <div key={i} style={{
            height: '3px', flex: 1, borderRadius: '2px',
            background: i <= strength ? colors[strength] : 'var(--border-subtle)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: '0.72rem', color: colors[strength] }}>{labels[strength]}</span>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate      = useNavigate();

  const [form, setForm]       = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name || !form.email || !form.password) {
      setError('All fields are required.'); return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.'); return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.'); return;
    }

    setLoading(true);
    try {
      await register({ full_name: form.full_name, email: form.email, password: form.password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">🧠</div>
          <span className="auth-logo-name">NeurolearnAI</span>
        </div>

        <h1 className="auth-title" style={{ fontSize: '1.5rem' }}>Create your account</h1>
        <p className="auth-subtitle">Join thousands of students learning smarter</p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit} id="register-form">
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full name</label>
            <div className="input-icon-wrap">
              <span className="input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input id="reg-name" name="full_name" type="text" className="form-input"
                placeholder="Your full name" value={form.full_name} onChange={handleChange} required />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email address</label>
            <div className="input-icon-wrap">
              <span className="input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <input id="reg-email" name="email" type="email" className="form-input"
                placeholder="you@example.com" value={form.email} onChange={handleChange}
                autoComplete="email" required />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <div className="input-icon-wrap">
              <span className="input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </span>
              <input id="reg-password" name="password" type={showPw ? 'text' : 'password'}
                className="form-input" placeholder="Create a strong password"
                value={form.password} onChange={handleChange} style={{ paddingRight: '48px' }} required />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <EyeIcon show={showPw} />
              </button>
            </div>
            <StrengthBar password={form.password} />
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Confirm password</label>
            <div className="input-icon-wrap">
              <span className="input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <input id="reg-confirm" name="confirm" type="password" className="form-input"
                placeholder="Re-enter password" value={form.confirm} onChange={handleChange} required
                style={{ borderColor: form.confirm && form.confirm !== form.password ? 'var(--accent-red)' : '' }} />
            </div>
            {form.confirm && form.confirm !== form.password && (
              <span className="form-error">Passwords don't match</span>
            )}
          </div>

          <button type="submit" id="register-submit"
            className={`btn btn-primary btn-full btn-lg ${loading ? 'btn-loading' : ''}`}
            disabled={loading}>
            {loading ? 'Creating account…' : '🚀 Get Started Free'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
