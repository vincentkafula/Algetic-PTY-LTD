'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '@/styles/dashboard.css';
import { getStoredUser, clearSession } from '@/lib/clientAuth';
import { useRequireAuth, useAuthedFetch } from '@/lib/useAuthedFetch';
import MailboxesPanel from '@/components/dashboard/MailboxesPanel';
import VoicePanel from '@/components/dashboard/VoicePanel';
import TeamCallingPanel from '@/components/dashboard/TeamCallingPanel';
import CallCentrePanel from '@/components/dashboard/CallCentrePanel';
import DomainsPanel from '@/components/dashboard/DomainsPanel';
import ProjectsPanel from '@/components/dashboard/ProjectsPanel';
import MvnoPanel from '@/components/dashboard/MvnoPanel';

// ---------------------------------------------------------------------------
// Ported from server/frontend/src/pages/dashboard/Dashboard.jsx. Same
// single-page, state-based view switching as the original (not separate
// Next.js routes per panel) — a deliberate choice to port the shell as
// directly as possible rather than introduce a different navigation
// architecture mid-migration.
//
// All 7 panels (Mailboxes, Voice, Team Calling, Call Centre, Domains,
// Projects, MVNO) are now wired in, each built and verified as its own
// phase rather than all at once — same incremental discipline as every
// backend phase in this migration.
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { view: 'mail', icon: '✉', label: 'Mailboxes' },
  { view: 'voice', icon: '☎', label: 'Phone numbers' },
  { view: 'sipnet', icon: '📶', label: 'Team calling' },
  { view: 'callcentre', icon: '📞', label: 'Call centre' },
  { view: 'mvno', icon: '📡', label: 'MVNO (demo)' },
  { view: 'domains', icon: '🌐', label: 'Domains' },
  { view: 'projects', icon: '🛠', label: 'Website, software & more' }
];

export default function DashboardPage() {
  useRequireAuth();
  const authedFetch = useAuthedFetch();
  const [view, setView] = useState('mail');
  const [health, setHealth] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  // getStoredUser() reads localStorage, which only exists client-side —
  // read it in an effect rather than during render, so the server-
  // rendered and first client-rendered pass match (avoids a hydration
  // mismatch, a real Next.js-specific concern the Vite version never had).
  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/health');
        setHealth(await res.json());
      } catch {
        setHealth({ error: true });
      }
    })();
  }, []);

  function logout() {
    clearSession();
    window.location.href = '/login';
  }

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand" style={{ padding: '0 0 20px' }}>
          <img src="/assets/img/logo-full.png" alt="Altegic Solutions" style={{ width: 160, height: 'auto', display: 'block' }} />
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.view}
              href="#"
              className={view === item.view ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setView(item.view); }}
            >
              {item.icon} {item.label}
            </a>
          ))}
          <Link href="/">← Back to site</Link>
        </nav>
      </div>

      <div className="main">
        <div className="account-bar">
          <div className="who">
            Signed in as{' '}
            <span className="value">
              {user ? (user.companyName ? `${user.email} (${user.companyName})` : user.email) : '…'}
            </span>
          </div>
          <button className="link-btn" onClick={logout}>Log out</button>
        </div>

        <HealthBanner health={health} />

        {view === 'mail' && <MailboxesPanel authedFetch={authedFetch} />}
        {view === 'voice' && <VoicePanel authedFetch={authedFetch} />}
        {view === 'sipnet' && <TeamCallingPanel authedFetch={authedFetch} health={health} />}
        {view === 'callcentre' && <CallCentrePanel authedFetch={authedFetch} health={health} />}
        {view === 'mvno' && <MvnoPanel authedFetch={authedFetch} />}
        {view === 'domains' && <DomainsPanel authedFetch={authedFetch} health={health} />}
        {view === 'projects' && <ProjectsPanel authedFetch={authedFetch} />}
      </div>
    </div>
  );
}

function HealthBanner({ health }: { health: any }) {
  if (!health) return <div className="status-banner warn">Checking connection…</div>;
  if (health.error) {
    return <div className="status-banner warn">Could not reach the server. Please try again shortly.</div>;
  }
  if (health.mailgunConfigured && health.twilioConfigured) {
    return <div className="status-banner ok">Connected — supported number countries: {health.supportedCountries.join(', ')}</div>;
  }
  return <div className="status-banner warn">Some services are still being set up on this account — a few features below may not be available yet.</div>;
}
