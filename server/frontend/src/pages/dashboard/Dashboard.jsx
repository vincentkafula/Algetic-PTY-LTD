import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/global.css';
import { getStoredUser, clearSession } from '../../lib/api';
import { useRequireAuth, useAuthedFetch } from '../../lib/useAuthedFetch';

import MailboxesPanel from './MailboxesPanel.jsx';
import VoicePanel from './VoicePanel.jsx';
import SipNetworkPanel from './SipNetworkPanel.jsx';
import CallCentrePanel from './CallCentrePanel.jsx';
import DomainsPanel from './DomainsPanel.jsx';
import ProjectsPanel from './ProjectsPanel.jsx';
import MvnoPanel from './MvnoPanel.jsx';

const NAV_ITEMS = [
  { view: 'mail', icon: '✉', label: 'Mailboxes' },
  { view: 'voice', icon: '☎', label: 'Phone numbers' },
  { view: 'sipnet', icon: '🔒', label: 'Private SIP network' },
  { view: 'callcentre', icon: '📞', label: 'Call centre' },
  { view: 'mvno', icon: '📡', label: 'MVNO (demo)' },
  { view: 'domains', icon: '🌐', label: 'Domains' },
  { view: 'projects', icon: '🛠', label: 'Website, software & internet' }
];

export default function Dashboard() {
  useRequireAuth();
  const authedFetch = useAuthedFetch();
  const [view, setView] = useState('mail');
  const [health, setHealth] = useState(null);
  const user = getStoredUser();

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
        <div className="brand">
          <img src="/logo-icon.png" alt="Altegic" style={{ height: 16, width: 'auto', verticalAlign: '-3px', marginRight: 6 }} />
          Altegic
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
          <Link to="/">← Back to site</Link>
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
        {view === 'sipnet' && <SipNetworkPanel authedFetch={authedFetch} health={health} />}
        {view === 'callcentre' && <CallCentrePanel authedFetch={authedFetch} health={health} />}
        {view === 'mvno' && <MvnoPanel authedFetch={authedFetch} />}
        {view === 'domains' && <DomainsPanel authedFetch={authedFetch} health={health} />}
        {view === 'projects' && <ProjectsPanel authedFetch={authedFetch} />}
      </div>
    </div>
  );
}

function HealthBanner({ health }) {
  if (!health) return <div className="status-banner warn">Checking connection to Mailgun / Twilio…</div>;
  if (health.error) {
    return <div className="status-banner warn">Could not reach the Altegic server. Is `npm start` running in /server?</div>;
  }
  if (health.mailgunConfigured && health.twilioConfigured) {
    return <div className="status-banner ok">Connected — supported number countries: {health.supportedCountries.join(', ')}</div>;
  }
  const missing = [];
  if (!health.mailgunConfigured) missing.push('Mailgun');
  if (!health.twilioConfigured) missing.push('Twilio');
  return <div className="status-banner warn">Demo mode — add real {missing.join(' and ')} credentials to server/.env to go live.</div>;
}
