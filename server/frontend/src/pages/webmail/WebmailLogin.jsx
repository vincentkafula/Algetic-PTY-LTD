import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/webmailLogin.css';
import { wmIsLoggedIn, wmSetSession } from '../../lib/webmailApi';

export default function WebmailLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (wmIsLoggedIn()) navigate('/webmail', { replace: true });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/webmail/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign in failed');
        return;
      }
      wmSetSession(data.token, data.address);
      navigate('/webmail');
    } catch (err) {
      setError(err.message);
    }
  }

  function forgotPassword(e) {
    e.preventDefault();
    alert("Password reset isn't available yet — ask whoever manages your Altegic account to reset it for you.");
  }

  return (
    <div className="wm-shell">
      <div className="wm-illustration">
        <div className="wm-dots"></div>

        <svg className="wm-paper-plane" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>

        <div className="wm-mock-frame">
          <div className="wm-mock">
            <div className="wm-mock-top"><span className="wm-mock-dot"></span><span className="wm-mock-dot"></span><span className="wm-mock-dot"></span></div>
            <div className="wm-mock-body">
              <div className="wm-mock-sidebar">
                <div className="wm-mock-compose">✎ Compose</div>
                <div className="wm-mock-item active">Inbox <span className="wm-mock-badge">12</span></div>
                <div className="wm-mock-item">Starred</div>
                <div className="wm-mock-item">Sent</div>
                <div className="wm-mock-item">Spam</div>
                <div className="wm-mock-item">Trash</div>
              </div>
              <div className="wm-mock-list">
                <div className="wm-mock-row"><span className="name">Olivia Smith</span><span className="time">2m</span></div>
                <div className="wm-mock-row"><span className="sub">Project update</span></div>
                <div className="wm-mock-row"><span className="name">Jacob Johnson</span><span className="time">1h</span></div>
                <div className="wm-mock-row"><span className="sub">Meeting tomorrow</span></div>
                <div className="wm-mock-row"><span className="name">Emma Williams</span><span className="time">3h</span></div>
                <div className="wm-mock-row"><span className="sub">Design feedback</span></div>
                <div className="wm-mock-row"><span className="name">Michael Brown</span><span className="time">5h</span></div>
                <div className="wm-mock-row"><span className="sub">Invoice attached</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="wm-float-envelope">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
          <span className="wm-float-badge">1</span>
        </div>
      </div>

      <div className="wm-form-side">
        <div className="wm-card">
          <div className="wm-logo">
            <img src="/logo-icon.png" alt="Altegic" />
          </div>
          <div style={{ textAlign: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>Altegic Webmail</div>
          <h1>Welcome Back</h1>
          <p className="wm-sub">Sign in with the email address and password for your domain registered with, or transferred to, Altegic.</p>

          <form onSubmit={handleSubmit}>
            <div className="wm-field-wrap">
              <label>Email Address</label>
              <svg className="wm-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3.1-6.2 7-6.2s7 2.2 7 6.2" /></svg>
              <input type="email" placeholder="you@yourdomain.com" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="wm-field-wrap">
              <label>Password</label>
              <svg className="wm-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
              <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="wm-toggle-pw" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.94 10.94 0 0112 20C5 20 1 12 1 12a19 19 0 015.06-6.06M9.9 4.24A10 10 0 0112 4c7 0 11 8 11 8a19 19 0 01-3.22 4.36M1 1l22 22" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
            <div className="wm-row-between">
              <label><input type="checkbox" style={{ width: 'auto' }} /> Remember me</label>
              <a href="#" onClick={forgotPassword}>Forgot password?</a>
            </div>
            <div className="wm-error">{error}</div>
            <button type="submit" className="primary" style={{ width: '100%', padding: 13, fontSize: 14 }}>Sign In</button>
          </form>

          <p className="wm-footer-line" style={{ marginTop: 24 }}>
            Don't have a mailbox yet? Ask whoever manages your Altegic account to create one, or <Link to="/login">create an Altegic account</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
