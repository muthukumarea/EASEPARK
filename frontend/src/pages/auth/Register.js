import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getApiErrorMessage, registerUser, withRetry } from '../../services/api';

const features = [
  ['🗺️','Find spots on live map'],
  ['⚡','Real-time availability'],
  ['🔒','Bank-grade secure payments'],
  ['📋','Full booking history'],
];

const getPwStrength = (pw) => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};

export default function Register() {
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pwStrength = getPwStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error('Please fill all required fields'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await withRetry(() => registerUser(form));
      toast.success('OTP sent! Check your email.');
      navigate('/verify-otp', { state: { email: form.email, type: 'register' } });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Registration failed'));
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      {/* Left panel */}
      <div className="auth-panel-left">
        <div className="auth-deco" /><div className="auth-deco2" />
        <div className="auth-panel-left-content">
          <div className="auth-brand">
            <div className="auth-brand-icon">🅿️</div>
            <span className="auth-brand-name">Ease<span>Park</span></span>
          </div>
          <h1 className="auth-tagline">Park smarter,<br />not <em>harder.</em></h1>
          <p className="auth-desc">Join thousands of drivers who use EasePark to find and book parking in seconds — no app download needed.</p>
          <div className="auth-features">
            {features.map(([icon, label]) => (
              <div className="auth-feat" key={label}>
                <div className="auth-feat-dot">{icon}</div>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-panel-right">
        <div className="auth-card fade-up">
          <div className="auth-card-header">
            <div className="auth-step">✦ Step 1 of 2</div>
            <h2>Create your account</h2>
            <p>Fill in your details — we'll verify your email next</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <div className="field">
                <label className="field-label">Full Name *</label>
                <div className="field-wrap">
                  <span className="field-icon">👤</span>
                  <input className="input" placeholder="John Doe" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Phone Number</label>
                <div className="field-wrap">
                  <span className="field-icon">📱</span>
                  <input className="input" placeholder="+91 9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Email Address *</label>
              <div className="field-wrap">
                <span className="field-icon">✉️</span>
                <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Password *</label>
              <div className="field-wrap">
                <span className="field-icon">🔑</span>
                <input
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  style={{ paddingRight: 42 }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, opacity:0.5 }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
              {form.password && (
                <div className="pw-strength" style={{ marginTop: 8 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`pw-bar ${pwStrength >= i ? (pwStrength <= 1 ? 'weak' : pwStrength <= 2 ? 'fair' : 'strong') : ''}`} />
                  ))}
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>
                    {['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength]}
                  </span>
                </div>
              )}
            </div>

            <button type="submit" className={`btn btn-primary btn-lg btn-block${loading ? ' btn-load' : ''}`} disabled={loading}>
              {loading ? '' : 'Send Verification OTP →'}
            </button>
          </form>

          <div className="auth-divider">or</div>
          <p style={{ textAlign:'center', fontSize:14, color:'var(--muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color:'var(--accent)', fontWeight:600, textDecoration:'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
