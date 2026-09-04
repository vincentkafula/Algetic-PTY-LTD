import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/global.css';
import { isLoggedIn, setSession } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');

  // Same behavior as the vanilla page: already-logged-in visitors skip
  // straight to the dashboard instead of seeing the login form.
  useEffect(() => {
    if (isLoggedIn()) navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <>
      <div className="nav">
        <div className="brand">
          <img src="/logo-full.png" alt="Altegic Solutions" style={{ height: 38, width: 'auto', display: 'block' }} />
        </div>
        <div className="links">
          <Link to="/">Home</Link>
        </div>
      </div>

      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
              Log in
            </button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>
              Create account
            </button>
          </div>

          {tab === 'login' ? <LoginForm /> : <SignupForm />}
        </div>
      </div>
    </>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      setSession(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>Email</label>
      <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Password</label>
      <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit" className="primary" style={{ width: '100%', marginTop: 8 }}>
        Log in
      </button>
      <div className="auth-error">{error}</div>
    </form>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, companyName: companyName.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign up failed');
        return;
      }
      setSession(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>Company name (optional)</label>
      <input type="text" autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
      <label>Email</label>
      <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Password</label>
      <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <p className="hint">At least 8 characters.</p>
      <button type="submit" className="primary" style={{ width: '100%', marginTop: 8 }}>
        Create account
      </button>
      <div className="auth-error">{error}</div>
    </form>
  );
}
