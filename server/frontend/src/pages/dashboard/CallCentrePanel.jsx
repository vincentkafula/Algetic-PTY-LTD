import { useState, useEffect, useCallback } from 'react';

function parseMenuOptions(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [digit, action, ...rest] = line.split(':');
    return { digit: (digit || '').trim(), action: (action || '').trim(), target: rest.join(':').trim() };
  });
}

export default function CallCentrePanel({ authedFetch, health }) {
  // menus
  const [menus, setMenus] = useState([]);
  const [menuName, setMenuName] = useState('');
  const [menuGreeting, setMenuGreeting] = useState('');
  const [menuOptions, setMenuOptions] = useState('');
  const [menuResult, setMenuResult] = useState(null);

  // queues
  const [queues, setQueues] = useState([]);
  const [queueName, setQueueName] = useState('');
  const [queueResult, setQueueResult] = useState(null);

  // agents
  const [agents, setAgents] = useState([]);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentQueue, setAgentQueue] = useState('');
  const [agentResult, setAgentResult] = useState(null);

  // number assignment
  const [numbers, setNumbers] = useState([]);
  const [assignNumber, setAssignNumber] = useState('');
  const [assignMenu, setAssignMenu] = useState('');
  const [assignResult, setAssignResult] = useState(null);

  const loadMenus = useCallback(async () => {
    try {
      const res = await authedFetch('/api/call-centre/menus');
      const data = await res.json();
      setMenus(data.menus || []);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  const loadQueues = useCallback(async () => {
    try {
      const res = await authedFetch('/api/call-centre/queues');
      const data = await res.json();
      const list = data.queues || [];
      const withWaiting = await Promise.all(list.map(async (q) => {
        let waiting = '—';
        try {
          const statusRes = await authedFetch(`/api/call-centre/queues/${q.id}/status`);
          const statusData = await statusRes.json();
          if (statusRes.ok) waiting = statusData.currentSize;
        } catch { /* leave as — if Twilio isn't configured */ }
        return { ...q, waiting };
      }));
      setQueues(withWaiting);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  const loadAgents = useCallback(async () => {
    try {
      const [agentsRes, queuesRes] = await Promise.all([
        authedFetch('/api/call-centre/agents'),
        authedFetch('/api/call-centre/queues')
      ]);
      const agentsData = await agentsRes.json();
      const queuesData = await queuesRes.json();
      const queueNames = {};
      (queuesData.queues || []).forEach((q) => { queueNames[q.id] = q.name; });
      setAgents((agentsData.agents || []).map((a) => ({ ...a, queueName: queueNames[a.queueId] || '—' })));
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  const loadCcNumbers = useCallback(async () => {
    try {
      const [numbersRes, menusRes] = await Promise.all([
        authedFetch('/api/numbers'),
        authedFetch('/api/call-centre/menus')
      ]);
      const numbersData = await numbersRes.json();
      const menusData = await menusRes.json();
      const menuNames = {};
      (menusData.menus || []).forEach((m) => { menuNames[m.id] = m.name; });
      setNumbers((numbersData.provisioned || []).map((n) => ({ ...n, menuName: n.callCentreMenuId ? (menuNames[n.callCentreMenuId] || 'Unknown menu') : null })));
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => {
    loadMenus();
    loadQueues();
    loadAgents();
    loadCcNumbers();
  }, [loadMenus, loadQueues, loadAgents, loadCcNumbers]);

  async function createMenu() {
    if (!menuName.trim() || !menuGreeting.trim()) { setMenuResult({ error: 'Name and greeting are required.' }); return; }
    const options = parseMenuOptions(menuOptions);
    if (options.length === 0) { setMenuResult({ error: 'Add at least one option line.' }); return; }
    setMenuResult({ loading: true });
    try {
      const res = await authedFetch('/api/call-centre/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: menuName.trim(), greeting: menuGreeting.trim(), options })
      });
      const data = await res.json();
      if (!res.ok) { setMenuResult({ error: data.error }); return; }
      setMenuResult({ success: `Created "${data.name}". Its id is ${data.id} — use that as a target for "menu" or "queue" options.` });
      setMenuName(''); setMenuGreeting(''); setMenuOptions('');
      loadMenus();
    } catch (err) {
      setMenuResult({ error: err.message });
    }
  }

  async function deleteMenu(id) {
    if (!confirm('Delete this menu?')) return;
    try {
      const res = await authedFetch(`/api/call-centre/menus/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete menu');
        return;
      }
      loadMenus();
    } catch (err) { alert(err.message); }
  }

  async function createQueue() {
    if (!queueName.trim()) { setQueueResult({ error: 'Enter a queue name.' }); return; }
    setQueueResult({ loading: true });
    try {
      const res = await authedFetch('/api/call-centre/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: queueName.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setQueueResult({ error: data.error }); return; }
      setQueueResult({ success: `Created "${data.name}". Its id is ${data.id} — use that as the target of a "queue" menu option.` });
      setQueueName('');
      loadQueues();
    } catch (err) {
      setQueueResult({ error: err.message });
    }
  }

  async function deleteQueue(id) {
    if (!confirm('Delete this queue?')) return;
    try {
      const res = await authedFetch(`/api/call-centre/queues/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete queue');
        return;
      }
      loadQueues();
    } catch (err) { alert(err.message); }
  }

  async function createAgent() {
    if (!agentName.trim() || !agentPhone.trim() || !agentQueue) { setAgentResult({ error: 'Name, phone, and queue are all required.' }); return; }
    setAgentResult({ loading: true });
    try {
      const res = await authedFetch('/api/call-centre/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agentName.trim(), phoneNumber: agentPhone.trim(), queueId: agentQueue })
      });
      const data = await res.json();
      if (!res.ok) { setAgentResult({ error: data.error }); return; }
      setAgentResult({ success: `Added ${data.name}.` });
      setAgentName(''); setAgentPhone('');
      loadAgents();
    } catch (err) {
      setAgentResult({ error: err.message });
    }
  }

  async function toggleAgentAvailability(id, available) {
    try {
      const res = await authedFetch(`/api/call-centre/agents/${id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to update availability');
      }
      loadAgents();
    } catch (err) { alert(err.message); }
  }

  async function deleteAgent(id) {
    if (!confirm('Remove this agent?')) return;
    try {
      const res = await authedFetch(`/api/call-centre/agents/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to remove agent');
        return;
      }
      loadAgents();
    } catch (err) { alert(err.message); }
  }

  async function assignNumberToMenu() {
    if (!assignNumber || !assignMenu) { setAssignResult({ error: 'Select both a number and a menu.' }); return; }
    setAssignResult({ loading: true });
    try {
      const res = await authedFetch(`/api/call-centre/numbers/${assignNumber}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuId: assignMenu })
      });
      const data = await res.json();
      if (!res.ok) { setAssignResult({ error: data.error }); return; }
      setAssignResult({ success: 'Assigned.' });
      loadCcNumbers();
    } catch (err) {
      setAssignResult({ error: err.message });
    }
  }

  async function unassignNumber(numberId) {
    if (!confirm('Unassign this number from the call centre? It will stop handling calls until reassigned.')) return;
    try {
      const res = await authedFetch(`/api/call-centre/numbers/${numberId}/unassign`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to unassign');
        return;
      }
      loadCcNumbers();
    } catch (err) { alert(err.message); }
  }

  return (
    <div>
      <h1>Call centre</h1>
      <p className="subtitle">
        IVR menus, queues, and agents — built on the phone numbers above.
        Assigning a number here detaches it from any SIP trunk it was on
        (a number can only do one job at a time).
      </p>

      {health?.callCentreConfigured ? (
        <div className="status-banner ok">Connected and ready.</div>
      ) : (
        <div className="status-banner warn">Not configured yet — contact support to get this feature enabled on your account.</div>
      )}

      <div className="panel-box">
        <h2>IVR menus</h2>
        <div className="form-row">
          <input value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Menu name, e.g. Main Menu" style={{ flex: 1, minWidth: 180 }} />
        </div>
        <div className="form-row">
          <input value={menuGreeting} onChange={(e) => setMenuGreeting(e.target.value)} placeholder="Greeting, e.g. Press 1 for sales, 2 for support" style={{ flex: 1, minWidth: 260 }} />
        </div>
        <div className="form-row">
          <textarea
            value={menuOptions}
            onChange={(e) => setMenuOptions(e.target.value)}
            rows={3}
            placeholder={'One option per line: digit:action:target\n1:dial:+14155551234\n2:queue:<queue id>\n3:hangup:Thanks, goodbye'}
            style={{ flex: 1, minWidth: 260, background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--text)', padding: '10px 12px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}
          />
        </div>
        <p className="hint" style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 16px' }}>
          Actions: <code>dial</code> (target = phone number), <code>queue</code> (target = a queue id, see below),{' '}
          <code>menu</code> (target = another menu id, for submenus), <code>hangup</code> (target = closing message).
        </p>
        <button className="primary voice" onClick={createMenu}>Create menu</button>
        {menuResult?.loading && <p style={{ color: 'var(--muted)' }}>Saving…</p>}
        {menuResult?.error && <p style={{ color: 'var(--danger)' }}>{menuResult.error}</p>}
        {menuResult?.success && <p style={{ color: 'var(--mail)' }}>{menuResult.success}</p>}
        <table>
          <thead><tr><th>Name</th><th>Greeting</th><th>Options</th><th></th></tr></thead>
          <tbody>
            {menus.length === 0 ? (
              <tr className="empty-row"><td colSpan={4}>No menus yet</td></tr>
            ) : menus.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.greeting}</td>
                <td className="mono">{(m.options || []).map((o) => `${o.digit}→${o.action}`).join(', ')}</td>
                <td><button className="danger" onClick={() => deleteMenu(m.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Queues</h2>
        <div className="form-row">
          <input value={queueName} onChange={(e) => setQueueName(e.target.value)} placeholder="Queue name, e.g. support" />
          <button className="primary voice" onClick={createQueue}>Create queue</button>
        </div>
        {queueResult?.loading && <p style={{ color: 'var(--muted)' }}>Creating…</p>}
        {queueResult?.error && <p style={{ color: 'var(--danger)' }}>{queueResult.error}</p>}
        {queueResult?.success && <p style={{ color: 'var(--mail)' }}>{queueResult.success}</p>}
        <table>
          <thead><tr><th>Name</th><th>Waiting now</th><th></th></tr></thead>
          <tbody>
            {queues.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>No queues yet</td></tr>
            ) : queues.map((q) => (
              <tr key={q.id}>
                <td>{q.name}</td>
                <td>{q.waiting}</td>
                <td><button className="danger" onClick={() => deleteQueue(q.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Agents</h2>
        <div className="form-row">
          <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Agent name" />
          <input value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} placeholder="+14155551234" />
          <select value={agentQueue} onChange={(e) => setAgentQueue(e.target.value)}>
            <option value="">Select a queue…</option>
            {queues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <button className="primary voice" onClick={createAgent}>Add agent</button>
        </div>
        {agentResult?.loading && <p style={{ color: 'var(--muted)' }}>Adding…</p>}
        {agentResult?.error && <p style={{ color: 'var(--danger)' }}>{agentResult.error}</p>}
        {agentResult?.success && <p style={{ color: 'var(--mail)' }}>{agentResult.success}</p>}
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Queue</th><th>Available</th><th></th></tr></thead>
          <tbody>
            {agents.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>No agents yet</td></tr>
            ) : agents.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td className="mono">{a.phoneNumber}</td>
                <td>{a.queueName}</td>
                <td><input type="checkbox" checked={a.available} onChange={(e) => toggleAgentAvailability(a.id, e.target.checked)} /></td>
                <td><button className="danger" onClick={() => deleteAgent(a.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Assign a number</h2>
        <div className="form-row">
          <select value={assignNumber} onChange={(e) => setAssignNumber(e.target.value)}>
            <option value="">Select a number…</option>
            {numbers.map((n) => <option key={n.id} value={n.id}>{n.phoneNumber}</option>)}
          </select>
          <select value={assignMenu} onChange={(e) => setAssignMenu(e.target.value)}>
            <option value="">Select a menu…</option>
            {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button className="primary voice" onClick={assignNumberToMenu}>Assign</button>
        </div>
        {assignResult?.loading && <p style={{ color: 'var(--muted)' }}>Assigning…</p>}
        {assignResult?.error && <p style={{ color: 'var(--danger)' }}>{assignResult.error}</p>}
        {assignResult?.success && <p style={{ color: 'var(--mail)' }}>{assignResult.success}</p>}
        <table>
          <thead><tr><th>Number</th><th>Assigned menu</th><th></th></tr></thead>
          <tbody>
            {numbers.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>No numbers yet — provision one under Phone numbers first</td></tr>
            ) : numbers.map((n) => (
              <tr key={n.id}>
                <td className="mono">{n.phoneNumber}</td>
                <td>{n.menuName || '—'}</td>
                <td>{n.callCentreMenuId && <button className="danger" onClick={() => unassignNumber(n.id)}>Unassign</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
