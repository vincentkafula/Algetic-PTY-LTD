import { useState, useEffect, useCallback } from 'react';

export default function TeamCallingPanel({ authedFetch, health }) {
  const [domainName, setDomainName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [numbers, setNumbers] = useState([]);
  const [assignNumber, setAssignNumber] = useState('');
  const [assignMember, setAssignMember] = useState('');
  const [assignResult, setAssignResult] = useState(null);

  const loadMembers = useCallback(async () => {
    try {
      const res = await authedFetch('/api/team-calling/members');
      const data = await res.json();
      if (!res.ok) { setLoadError(data.error); return; }
      setLoadError(null);
      setMembers(data.members || []);
      setDomainName(data.domainName || '');
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  const loadNumbers = useCallback(async () => {
    try {
      const res = await authedFetch('/api/numbers');
      const data = await res.json();
      setNumbers(data.provisioned || []);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { loadMembers(); loadNumbers(); }, [loadMembers, loadNumbers]);

  async function addMember() {
    if (!username.trim() || password.length < 8) { setResult({ error: 'Enter a username and a password of at least 8 characters.' }); return; }
    setResult({ loading: true });
    try {
      const res = await authedFetch('/api/team-calling/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) { setResult({ error: data.error }); return; }
      setResult({ success: `${data.created ? 'Added' : 'Updated'} ${data.username}@${data.domainName}.` });
      setUsername('');
      setPassword('');
      loadMembers();
    } catch (err) {
      setResult({ error: err.message });
    }
  }

  async function removeMember(u) {
    if (!confirm(`Remove ${u}? Their softphone will stop being able to register or call immediately.`)) return;
    try {
      const res = await authedFetch(`/api/team-calling/members/${encodeURIComponent(u)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to remove member');
        return;
      }
      loadMembers();
    } catch (err) {
      alert(err.message);
    }
  }

  async function assignNumberToMember() {
    if (!assignNumber || !assignMember) { setAssignResult({ error: 'Select both a number and a team member.' }); return; }
    setAssignResult({ loading: true });
    try {
      const res = await authedFetch(`/api/team-calling/numbers/${assignNumber}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: assignMember })
      });
      const data = await res.json();
      if (!res.ok) { setAssignResult({ error: data.error }); return; }
      setAssignResult({ success: 'Assigned.' });
      loadNumbers();
    } catch (err) {
      setAssignResult({ error: err.message });
    }
  }

  async function unassignNumber(numberId) {
    if (!confirm('Unassign this number? It will stop ringing anyone until reassigned.')) return;
    try {
      const res = await authedFetch(`/api/team-calling/numbers/${numberId}/unassign`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to unassign');
        return;
      }
      loadNumbers();
    } catch (err) { alert(err.message); }
  }

  return (
    <div>
      <h1>Team calling</h1>
      <p className="subtitle">
        A real calling network for your team — register a softphone
        directly with a username and password, no VPS or self-hosted
        server involved. Registered members can call each other directly,
        dial out to any real phone number, and a purchased number can be
        assigned to ring a specific member.
      </p>

      {health?.teamCallingConfigured ? (
        <div className="status-banner ok">
          Connected — your team's calling domain is <span className="mono">{domainName || '…'}</span>
        </div>
      ) : (
        <div className="status-banner warn">Not configured yet — contact support to get this feature enabled on your account.</div>
      )}

      <div className="panel-box">
        <h2>Add a team member</h2>
        <div className="form-row">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username, e.g. alice" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password (min 8 characters)" style={{ flex: 1, minWidth: 200 }} />
          <button className="primary voice" onClick={addMember}>Add / update</button>
        </div>
        <p className="hint" style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 16px' }}>
          Adding a username that already exists resets their password instead
          of creating a duplicate. There's no password recovery — if someone
          forgets theirs, just add them again with a new one. Give the
          resulting username, password, and domain to any SIP softphone
          (e.g. Zoiper, Linphone) to register it for real.
        </p>
        {result?.loading && <p style={{ color: 'var(--muted)' }}>Saving…</p>}
        {result?.error && <p style={{ color: 'var(--danger)' }}>{result.error}</p>}
        {result?.success && <p style={{ color: 'var(--mail)' }}>{result.success}</p>}
      </div>

      <div className="panel-box">
        <h2>Team members</h2>
        <table>
          <thead><tr><th>Username</th><th>SIP address</th><th></th></tr></thead>
          <tbody>
            {loadError ? (
              <tr className="empty-row"><td colSpan={3}>{loadError}</td></tr>
            ) : members.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>No team members yet</td></tr>
            ) : members.map((u) => (
              <tr key={u}>
                <td className="mono">{u}</td>
                <td className="mono">{u}@{domainName}</td>
                <td><button className="danger" onClick={() => removeMember(u)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Assign a number to a team member</h2>
        <p className="subtitle" style={{ marginBottom: 16 }}>
          Makes a real, public phone number ring a specific team member's
          softphone. Detaches the number from any SIP trunk or Call Centre
          menu it was on — a number can only do one job at a time.
        </p>
        <div className="form-row">
          <select value={assignNumber} onChange={(e) => setAssignNumber(e.target.value)}>
            <option value="">Select a number…</option>
            {numbers.map((n) => <option key={n.id} value={n.id}>{n.phoneNumber}</option>)}
          </select>
          <select value={assignMember} onChange={(e) => setAssignMember(e.target.value)}>
            <option value="">Select a team member…</option>
            {members.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button className="primary voice" onClick={assignNumberToMember}>Assign</button>
        </div>
        {assignResult?.loading && <p style={{ color: 'var(--muted)' }}>Assigning…</p>}
        {assignResult?.error && <p style={{ color: 'var(--danger)' }}>{assignResult.error}</p>}
        {assignResult?.success && <p style={{ color: 'var(--mail)' }}>{assignResult.success}</p>}
        <table>
          <thead><tr><th>Number</th><th>Rings</th><th></th></tr></thead>
          <tbody>
            {numbers.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>No numbers yet — provision one under Phone numbers first</td></tr>
            ) : numbers.map((n) => (
              <tr key={n.id}>
                <td className="mono">{n.phoneNumber}</td>
                <td>{n.teamCallingMember || '—'}</td>
                <td>{n.teamCallingMember && <button className="danger" onClick={() => unassignNumber(n.id)}>Unassign</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
