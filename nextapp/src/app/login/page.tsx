'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, setSession } from '@/lib/clientAuth';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState('login');

  // Same behavior as the Vite version: already-logged-in visitors skip
  // straight to the dashboard instead of seeing the login form.
  useEffect(() => {
    if (isLoggedIn()) router.replace('/dashboard');
  }, [router]);

  return (
    <>
      <div className="site-logo" style={{ padding: '24px 0 0 40px' }}>
        <Link href="/"><img src="/assets/img/logo-full.png" alt="Altegic Solutions" style={{ height: 40, width: 'auto' }} /></Link>
      </div>

      <div className="contact_area section-padding" style={{ paddingTop: 32 }}>
        <div className="container">
          <div className="row">
            <div className="offset-lg-3 col-lg-6 col-sm-12 col-xs-12">
              <div className="contact">
                <div className="section-title text-center" style={{ marginBottom: 24 }}>
                  <span>{tab === 'login' ? 'Welcome back' : 'Get started'}</span>
                  <h2>{tab === 'login' ? 'Log in to your account' : 'Create an account'}</h2>
                </div>

                <div className="row" style={{ marginBottom: 24 }}>
                  <div className="col-6">
                    <button
                      type="button"
                      onClick={() => setTab('login')}
                      className="btn_one"
                      style={{ width: '100%', opacity: tab === 'login' ? 1 : 0.55, border: 'none', cursor: 'pointer' }}
                    >
                      Log in
                    </button>
                  </div>
                  <div className="col-6">
                    <button
                      type="button"
                      onClick={() => setTab('signup')}
                      className="btn_one"
                      style={{ width: '100%', opacity: tab === 'signup' ? 1 : 0.55, border: 'none', cursor: 'pointer' }}
                    >
                      Create account
                    </button>
                  </div>
                </div>

                {tab === 'login' ? <LoginForm /> : <SignupForm />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
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
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="row">
        <div className="form-group col-md-12">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" className="form-control" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group col-md-12">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" className="form-control" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="col-md-12 text-center">
          <button type="submit" disabled={submitting} className="btn_one" style={{ width: '100%' }}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </div>
        {error && <div className="col-md-12 text-center" style={{ color: '#e74c3c', marginTop: 12 }}>{error}</div>}
      </div>
    </form>
  );
}

function SignupForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
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
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="row">
        <div className="form-group col-md-12">
          <label htmlFor="signup-company">Company name (optional)</label>
          <input id="signup-company" type="text" className="form-control" autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="form-group col-md-12">
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" className="form-control" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group col-md-12">
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" className="form-control" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <small style={{ color: '#888' }}>At least 8 characters.</small>
        </div>
        <div className="col-md-12 text-center" style={{ marginTop: 8 }}>
          <button type="submit" disabled={submitting} className="btn_one" style={{ width: '100%' }}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </div>
        {error && <div className="col-md-12 text-center" style={{ color: '#e74c3c', marginTop: 12 }}>{error}</div>}
      </div>
    </form>
  );
}
