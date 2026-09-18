'use client';

import { useState, useEffect, useCallback } from 'react';

export default function MvnoRealOperations({ authedFetch }) {
  const [plans, setPlans] = useState([]);
  const [sims, setSims] = useState([]);
  const [subscribers, setSubscribers] = useState([]);

  const [planName, setPlanName] = useState('');
  const [planType, setPlanType] = useState('prepaid');
  const [planData, setPlanData] = useState('');
  const [planVoice, setPlanVoice] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planResult, setPlanResult] = useState(null);

  const [simIccid, setSimIccid] = useState('');
  const [simType, setSimType] = useState('physical');
  const [simNote, setSimNote] = useState('');
  const [simResult, setSimResult] = useState(null);

  const [subName, setSubName] = useState('');
  const [subIdLast4, setSubIdLast4] = useState('');
  const [subSimIccid, setSubSimIccid] = useState('');
  const [subPlanId, setSubPlanId] = useState('');
  const [subResult, setSubResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, s, sub] = await Promise.all([
        authedFetch('/api/mvno/real/rate-plans'),
        authedFetch('/api/mvno/real/sim-inventory'),
        authedFetch('/api/mvno/real/subscribers')
      ]);
      setPlans((await p.json()).plans || []);
      setSims((await s.json()).sims || []);
      setSubscribers((await sub.json()).subscribers || []);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  async function createPlan() {
    if (!planName.trim() || !planPrice) { setPlanResult({ error: 'Name and price are required.' }); return; }
    setPlanResult({ loading: true });
    try {
      const res = await authedFetch('/api/mvno/real/rate-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planName.trim(),
          type: planType,
          dataGB: planData ? Number(planData) : null,
          voiceMinutes: planVoice ? Number(planVoice) : null,
          priceZAR: Number(planPrice)
        })
      });
      const data = await res.json();
      if (!res.ok) { setPlanResult({ error: data.error }); return; }
      setPlanResult({ success: true });
      setPlanName(''); setPlanData(''); setPlanVoice(''); setPlanPrice('');
      load();
    } catch (err) {
      setPlanResult({ error: err.message });
    }
  }

  async function deletePlan(id) {
    if (!confirm('Delete this rate plan?')) return;
    try {
      const res = await authedFetch(`/api/mvno/real/rate-plans/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete');
        return;
      }
      load();
    } catch (err) { alert(err.message); }
  }

  async function addSim() {
    if (!simIccid.trim()) { setSimResult({ error: 'ICCID is required.' }); return; }
    setSimResult({ loading: true });
    try {
      const res = await authedFetch('/api/mvno/real/sim-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iccid: simIccid.trim(), type: simType, batchNote: simNote.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) { setSimResult({ error: data.error }); return; }
      setSimResult({ success: true });
      setSimIccid(''); setSimNote('');
      load();
    } catch (err) {
      setSimResult({ error: err.message });
    }
  }

  async function deleteSim(id) {
    if (!confirm('Remove this SIM from inventory?')) return;
    try {
      const res = await authedFetch(`/api/mvno/real/sim-inventory/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete');
        return;
      }
      load();
    } catch (err) { alert(err.message); }
  }

  async function createSubscriber() {
    if (!subName.trim()) { setSubResult({ error: 'Full name is required.' }); return; }
    setSubResult({ loading: true });
    try {
      const res = await authedFetch('/api/mvno/real/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: subName.trim(),
          idNumberLast4: subIdLast4.trim() || undefined,
          simIccid: subSimIccid || undefined,
          ratePlanId: subPlanId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) { setSubResult({ error: data.error }); return; }
      setSubResult({ success: true });
      setSubName(''); setSubIdLast4(''); setSubSimIccid(''); setSubPlanId('');
      load();
    } catch (err) {
      setSubResult({ error: err.message });
    }
  }

  async function updateSubscriber(id, updates) {
    try {
      const res = await authedFetch(`/api/mvno/real/subscribers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to update');
        return;
      }
      load();
    } catch (err) { alert(err.message); }
  }

  async function deleteSubscriber(id) {
    if (!confirm('Remove this subscriber? Their SIM will be freed back to stock.')) return;
    try {
      const res = await authedFetch(`/api/mvno/real/subscribers/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete');
        return;
      }
      load();
    } catch (err) { alert(err.message); }
  }

  const availableSims = sims.filter((s) => s.status === 'in_stock');

  return (
    <div>
      <div className="status-banner ok" style={{ marginBottom: 6 }}>
        ✓ REAL OPERATIONS — these are your own persistent records, not simulated data.
        This is a genuine subscriber/SIM/plan ledger you can use to run an independent MVNO,
        alongside whatever MVNE/MNO wholesale partner you onboard with. Nothing here calls a
        real telecom network — MSISDN assignment and RICA verification are recorded manually
        here, reflecting work done through your actual network partner's own systems.
      </div>

      <div className="panel-box">
        <h2>Rate plans</h2>
        <div className="form-row">
          <input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Plan name" />
          <select value={planType} onChange={(e) => setPlanType(e.target.value)}>
            <option value="prepaid">Prepaid</option>
            <option value="postpaid">Postpaid</option>
          </select>
          <input value={planData} onChange={(e) => setPlanData(e.target.value)} placeholder="Data GB (blank = unlimited)" style={{ maxWidth: 200 }} />
          <input value={planVoice} onChange={(e) => setPlanVoice(e.target.value)} placeholder="Voice minutes" style={{ maxWidth: 160 }} />
          <input value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} placeholder="Price ZAR" style={{ maxWidth: 140 }} />
          <button className="primary" onClick={createPlan}>Add plan</button>
        </div>
        {planResult?.loading && <p style={{ color: 'var(--muted)' }}>Saving…</p>}
        {planResult?.error && <p style={{ color: 'var(--danger)' }}>{planResult.error}</p>}
        {planResult?.success && <p style={{ color: 'var(--mail)' }}>Plan added.</p>}
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Data</th><th>Voice</th><th>Price</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {plans.length === 0 ? (
              <tr className="empty-row"><td colSpan={7}>No rate plans yet</td></tr>
            ) : plans.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.type}</td>
                <td>{p.dataGB === null ? 'Unlimited' : `${p.dataGB} GB`}</td>
                <td>{p.voiceMinutes === null ? 'Unlimited' : `${p.voiceMinutes} min`}</td>
                <td>R{p.priceZAR}</td>
                <td>{p.active ? 'Yes' : 'No'}</td>
                <td><button className="danger" onClick={() => deletePlan(p.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>SIM inventory</h2>
        <div className="form-row">
          <input value={simIccid} onChange={(e) => setSimIccid(e.target.value)} placeholder="ICCID" style={{ flex: 1, minWidth: 220 }} />
          <select value={simType} onChange={(e) => setSimType(e.target.value)}>
            <option value="physical">Physical</option>
            <option value="esim">eSIM</option>
          </select>
          <input value={simNote} onChange={(e) => setSimNote(e.target.value)} placeholder="Batch note (optional)" style={{ flex: 1, minWidth: 180 }} />
          <button className="primary" onClick={addSim}>Add to stock</button>
        </div>
        {simResult?.loading && <p style={{ color: 'var(--muted)' }}>Saving…</p>}
        {simResult?.error && <p style={{ color: 'var(--danger)' }}>{simResult.error}</p>}
        {simResult?.success && <p style={{ color: 'var(--mail)' }}>Added to stock.</p>}
        <table>
          <thead><tr><th>ICCID</th><th>Type</th><th>Status</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {sims.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>No SIMs in stock yet</td></tr>
            ) : sims.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.iccid}</td>
                <td>{s.type}</td>
                <td>{s.status.replace(/_/g, ' ')}</td>
                <td>{s.batchNote || '—'}</td>
                <td>{s.status === 'in_stock' && <button className="danger" onClick={() => deleteSim(s.id)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Subscribers</h2>
        <div className="form-row">
          <input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Full name" />
          <input value={subIdLast4} onChange={(e) => setSubIdLast4(e.target.value)} placeholder="ID last 4 digits" style={{ maxWidth: 160 }} />
          <select value={subSimIccid} onChange={(e) => setSubSimIccid(e.target.value)}>
            <option value="">No SIM yet</option>
            {availableSims.map((s) => <option key={s.id} value={s.iccid}>{s.iccid}</option>)}
          </select>
          <select value={subPlanId} onChange={(e) => setSubPlanId(e.target.value)}>
            <option value="">No plan yet</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="primary" onClick={createSubscriber}>Add subscriber</button>
        </div>
        {subResult?.loading && <p style={{ color: 'var(--muted)' }}>Saving…</p>}
        {subResult?.error && <p style={{ color: 'var(--danger)' }}>{subResult.error}</p>}
        {subResult?.success && <p style={{ color: 'var(--mail)' }}>Subscriber added.</p>}
        <table>
          <thead><tr><th>Name</th><th>MSISDN</th><th>RICA</th><th>Status</th><th>SIM</th><th></th></tr></thead>
          <tbody>
            {subscribers.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>No subscribers yet</td></tr>
            ) : subscribers.map((s) => (
              <tr key={s.id}>
                <td>{s.fullName}</td>
                <td className="mono">
                  {s.msisdn || (
                    <button className="link-btn" onClick={() => {
                      const val = prompt('Enter the real MSISDN assigned by your network partner (e.g. +27821234567):');
                      if (val) updateSubscriber(s.id, { msisdn: val, status: 'pending_rica' });
                    }}>Assign number</button>
                  )}
                </td>
                <td>
                  <input type="checkbox" checked={s.ricaVerified} onChange={(e) => updateSubscriber(s.id, { ricaVerified: e.target.checked, status: e.target.checked ? 'active' : s.status })} />
                </td>
                <td>{s.status.replace(/_/g, ' ')}</td>
                <td className="mono">{s.simIccid || '—'}</td>
                <td><button className="danger" onClick={() => deleteSubscriber(s.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
