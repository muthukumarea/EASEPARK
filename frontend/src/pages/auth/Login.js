import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getApiErrorMessage, loginUser, withRetry } from '../../services/api';

export default function Login() {
  const [form, setForm] = useState({ email:'', password:'' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Please enter email and password'); return; }
    setLoading(true);
    try {
      await withRetry(() => loginUser(form));
      toast.success('OTP sent to your email!');
      navigate('/verify-otp', { state: { email: form.email, type: 'login' } });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Login failed'));
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
          <h1 className="auth-tagline">Welcome<br />back<em>.</em></h1>
          <p className="auth-desc">Your parking spaces are waiting. Log in to view your bookings, find new spots, and manage everything from one place.</p>
          <div style={{ marginTop: 36, padding: '20px', background:'rgba(255,255,255,0.05)', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:12, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>Two-step security</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[['🔑','Enter email & password'],['📧','Verify with OTP sent to email'],['✅','Access your account securely']].map(([icon,text]) => (
                <div key={text} style={{ display:'flex', alignItems:'center', gap:10, color:'rgba(255,255,255,0.7)', fontSize:13 }}>
                  <span style={{ fontSize:18 }}>{icon}</span>{text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-panel-right">
        <div className="auth-card fade-up">
          <div className="auth-card-header">
            <div className="auth-step">🔐 Secure Login</div>
            <h2>Sign in to EasePark</h2>
            <p>Enter your credentials — an OTP will be sent to verify it's you</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">Email Address</label>
              <div className="field-wrap">
                <span className="field-icon">✉️</span>
                <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} autoFocus />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Password</label>
              <div className="field-wrap">
                <span className="field-icon">🔑</span>
                <input className="input" type={showPw ? 'text' : 'password'} placeholder="Your password" value={form.password} onChange={e => set('password', e.target.value)} style={{ paddingRight:42 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, opacity:0.5 }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className={`btn btn-primary btn-lg btn-block${loading ? ' btn-load' : ''}`} disabled={loading} style={{ marginTop:4 }}>
              {loading ? '' : 'Continue →'}
            </button>
          </form>

          <div className="auth-divider">or</div>
          <p style={{ textAlign:'center', fontSize:14, color:'var(--muted)' }}>
            New to EasePark?{' '}
            <Link to="/register" style={{ color:'var(--accent)', fontWeight:600, textDecoration:'none' }}>Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
