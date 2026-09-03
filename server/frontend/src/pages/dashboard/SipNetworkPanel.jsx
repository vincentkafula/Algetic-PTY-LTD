import { useState, useEffect, useCallback } from 'react';

export default function SipNetworkPanel({ authedFetch, health }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [domain, setDomain] = useState('');
  const [loadError, setLoadError] = useState(null);

  const loadSipUsers = useCallback(async () => {
    try {
      const res = await authedFetch('/api/sip-network/users');
      const data = await res.json();
      if (!res.ok) { setLoadError(data.error); return; }
      setLoadError(null);
      setSubscribers(data.subscribers || []);
      setDomain(data.domain || '');
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { loadSipUsers(); }, [loadSipUsers]);

  async function addSipUser() {
    if (!username.trim() || !password) { setResult({ error: 'Enter a username and password.' }); return; }
    setResult({ loading: true });
    try {
      const res = await authedFetch('/api/sip-network/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) { setResult({ error: data.error }); return; }
      setResult({ success: `${data.created ? 'Added' : 'Updated'} ${data.username}@${data.domain}.` });
      setUsername('');
      setPassword('');
      loadSipUsers();
    } catch (err) {
      setResult({ error: err.message });
    }
  }

  async function removeSipUser(u) {
    if (!confirm(`Remove ${u}? Their phone will stop working immediately.`)) return;
    try {
      const res = await authedFetch(`/api/sip-network/users/${encodeURIComponent(u)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to remove subscriber');
        return;
      }
      loadSipUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <h1>Private SIP network</h1>
      <p className="subtitle">
        A separate, self-hosted calling system on your own VPS — no telecom
        carrier involved. This manages the shared subscriber list your{' '}
        <code>sip-network/</code> deployment uses; every account with access
        to this dashboard sees the same list (this feature is not isolated
        per Altegic account — see sip-network/README.md).
      </p>

      {health?.sipNetworkConfigured ? (
        <div className="status-banner ok">Connected to your private SIP network.</div>
      ) : (
        <div className="status-banner warn">
          Not configured — set SIP_NETWORK_API_URL and SIP_NETWORK_API_KEY in server/.env once you've deployed sip-network/.
        </div>
      )}

      <div className="panel-box">
        <h2>Add a subscriber</h2>
        <div className="form-row">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username, e.g. alice" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password (min 8 characters)" style={{ flex: 1, minWidth: 200 }} />
          <button className="primary" onClick={addSipUser}>Add / update</button>
        </div>
        <p className="hint" style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 16px' }}>
          Adding a username that already exists updates its password instead
          of creating a duplicate. There's no password recovery — if someone
          forgets theirs, just add them again with a new one.
        </p>
        {result?.loading && <p style={{ color: 'var(--muted)' }}>Saving…</p>}
        {result?.error && <p style={{ color: 'var(--danger)' }}>{result.error}</p>}
        {result?.success && <p style={{ color: 'var(--mail)' }}>{result.success}</p>}
      </div>

      <div className="panel-box">
        <h2>Subscribers</h2>
        <table>
          <thead><tr><th>Username</th><th>SIP address</th><th></th></tr></thead>
          <tbody>
            {loadError ? (
              <tr className="empty-row"><td colSpan={3}>{loadError}</td></tr>
            ) : subscribers.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>No subscribers yet</td></tr>
            ) : subscribers.map((u) => (
              <tr key={u}>
                <td className="mono">{u}</td>
                <td className="mono">{u}@{domain}</td>
                <td><button className="danger" onClick={() => removeSipUser(u)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
