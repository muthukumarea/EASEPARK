import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getApiErrorMessage, verifyRegisterOtp, verifyLoginOtp, resendOtp, withRetry } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function OtpVerify() {
  const [digits, setDigits] = useState(['','','','','','']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const refs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const { email, type } = location.state || {};
  const isRegister = type === 'register';

  useEffect(() => {
    if (!email) { navigate(isRegister ? '/register' : '/login'); return; }
    const t = setInterval(() => setCountdown(c => c > 0 ? c-1 : 0), 1000);
    return () => clearInterval(t);
  }, [email, navigate, isRegister]);

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits]; next[idx] = val; setDigits(next);
    if (val && idx < 5) refs.current[idx+1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs.current[idx-1]?.focus();
  };

  const handlePaste = (e) => {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if (p.length === 6) { setDigits(p.split('')); refs.current[5]?.focus(); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length !== 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      if (isRegister) {
        await withRetry(() => verifyRegisterOtp(email, otp));
        toast.success('🎉 Account verified! Please log in.');
        navigate('/login');
      } else {
        const res = await withRetry(() => verifyLoginOtp(email, otp));
        const { token, user } = res.data.data;
        login(token, user);
        toast.success(`Welcome back, ${user.name}!`);
        navigate(user.role === 'admin' ? '/admin' : '/');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Invalid OTP'));
      setDigits(['','','','','','']);
      refs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await withRetry(() => resendOtp(email, type));
      toast.success('New OTP sent!');
      setCountdown(60);
      setDigits(['','','','','','']);
      refs.current[0]?.focus();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to resend'));
    } finally { setResending(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel-left">
        <div className="auth-deco" /><div className="auth-deco2" />
        <div className="auth-panel-left-content">
          <div className="auth-brand">
            <div className="auth-brand-icon">🅿️</div>
            <span className="auth-brand-name">Ease<span>Park</span></span>
          </div>
          <h1 className="auth-tagline">One last<br />step<em>.</em></h1>
          <p className="auth-desc">We take security seriously. Every login and registration is verified with a one-time code sent directly to your inbox.</p>
          <div style={{ marginTop:32, padding:'16px 20px', background:'rgba(0,201,167,0.08)', border:'1px solid rgba(0,201,167,0.2)', borderRadius:14 }}>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, marginBottom:8 }}>OTP sent to</p>
            <p style={{ color:'#fff', fontWeight:700, fontSize:16, letterSpacing:-0.3 }}>{email}</p>
            <p style={{ color:'rgba(0,201,167,0.8)', fontSize:12, marginTop:6 }}>Check your spam folder if not received</p>
          </div>
        </div>
      </div>

      <div className="auth-panel-right">
        <div className="auth-card fade-up">
          <div className="auth-card-header">
            <div className="auth-step">{isRegister ? '✦ Step 2 of 2 · Verify Email' : '🔐 Two-Factor Verification'}</div>
            <h2>Enter your OTP</h2>
            <p>6-digit code sent to <strong>{email}</strong></p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="otp-row" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input key={i}
                  ref={el => refs.current[i] = el}
                  className={`otp-box${d ? ' filled' : ''}`}
                  type="text" inputMode="numeric" maxLength={1}
                  value={d}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button type="submit" className={`btn btn-primary btn-lg btn-block${loading ? ' btn-load' : ''}`} disabled={loading}>
              {loading ? '' : isRegister ? 'Verify & Activate Account ✓' : 'Verify & Sign In ✓'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:20 }}>
            {countdown > 0 ? (
              <p className="text-muted">Resend OTP in <strong style={{ color:'var(--ink)' }}>{countdown}s</strong></p>
            ) : (
              <button className="link-btn" onClick={handleResend} disabled={resending}>
                {resending ? 'Sending...' : '↻ Resend OTP'}
              </button>
            )}
          </div>

          <div style={{ textAlign:'center', marginTop:12 }}>
            <button className="link-muted" onClick={() => navigate(isRegister ? '/register' : '/login')}>
              ← {isRegister ? 'Back to registration' : 'Back to login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
