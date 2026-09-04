import { useState, useEffect, useCallback } from 'react';
import { redirectToPayfastCheckout } from '../../lib/payfastCheckout';

export default function VoicePanel({ authedFetch }) {
  const [country, setCountry] = useState('US');
  const [areaCode, setAreaCode] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [provisionResult, setProvisionResult] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [trunk, setTrunk] = useState(null);
  const [trunkError, setTrunkError] = useState(null);
  const [originationUri, setOriginationUri] = useState('');
  const [trunkResult, setTrunkResult] = useState(null);

  const loadNumbers = useCallback(async () => {
    try {
      const res = await authedFetch('/api/numbers');
      const data = await res.json();
      setNumbers(data.provisioned || []);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  const loadTrunk = useCallback(async () => {
    try {
      const res = await authedFetch('/api/numbers/trunk');
      if (res.status === 404) { setTrunk(null); setTrunkError(null); return; }
      const data = await res.json();
      if (!res.ok) { setTrunkError(data.error); return; }
      setTrunk(data.trunk);
      setTrunkError(null);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { loadNumbers(); loadTrunk(); }, [loadNumbers, loadTrunk]);

  async function searchNumbers() {
    setSearchResults(null);
    setSearchError(null);
    setProvisionResult(null);

    const trimmedAreaCode = areaCode.trim();
    if (trimmedAreaCode && !/^\d{2,4}$/.test(trimmedAreaCode)) {
      setSearchError(
        `"${trimmedAreaCode}" doesn't look like an area code. An area code is the local code within a country — e.g. 415 for San Francisco — not the country code (that's already set by the Country dropdown above). Leave this blank to search the whole country.`
      );
      return;
    }

    setSearchResults('loading');
    try {
      const qs = new URLSearchParams({ country });
      if (trimmedAreaCode) qs.set('areaCode', trimmedAreaCode);
      const res = await authedFetch(`/api/numbers/search?${qs}`);
      const data = await res.json();
      if (!res.ok) { setSearchError(data.error); setSearchResults(null); return; }
      setSearchResults(data.results || []);
    } catch (err) {
      setSearchError(err.message);
      setSearchResults(null);
    }
  }

  async function provisionNumber(phoneNumber) {
    setProvisionResult({ loading: true });
    try {
      const res = await authedFetch('/api/numbers/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, country })
      });
      const data = await res.json();
      if (!res.ok) { setProvisionResult({ error: data.error }); return; }
      setProvisionResult({ redirecting: true });
      redirectToPayfastCheckout(data.payfastUrl, data.checkoutFields);
    } catch (err) {
      setProvisionResult({ error: err.message });
    }
  }

  async function releaseNumber(id) {
    if (!confirm('Release this number? It will stop working immediately.')) return;
    try {
      const res = await authedFetch(`/api/numbers/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to release number');
        return;
      }
      loadNumbers();
    } catch (err) {
      alert(err.message);
    }
  }

  async function setTrunkOrigination() {
    if (!originationUri.trim()) { setTrunkResult({ error: 'Enter a SIP URI first.' }); return; }
    setTrunkResult({ loading: true });
    try {
      const res = await authedFetch('/api/numbers/trunk/origination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sipUri: originationUri.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setTrunkResult({ error: data.error }); return; }
      setTrunkResult({ success: 'Origination address updated.' });
      setOriginationUri('');
      loadTrunk();
    } catch (err) {
      setTrunkResult({ error: err.message });
    }
  }

  async function resetTrunkPassword() {
    if (!confirm('Reset the SIP password? Any device using the current password will stop working until updated.')) return;
    try {
      const res = await authedFetch('/api/numbers/trunk/reset-password', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setTrunkResult({ error: data.error }); return; }
      setTrunkResult({ passwordReset: data });
      loadTrunk();
    } catch (err) {
      setTrunkResult({ error: err.message });
    }
  }

  return (
    <div>
      <h1>Phone numbers</h1>
      <p className="subtitle">Search available numbers, provision one, and issue SIP credentials for an IP phone.</p>

      <div className="panel-box">
        <h2>Search numbers</h2>
        <div className="form-row">
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="ZA">South Africa</option>
            <option value="ZM">Zambia</option>
            <option value="CN" disabled>China — not available (see note below)</option>
          </select>
          <input value={areaCode} onChange={(e) => setAreaCode(e.target.value)} placeholder="local area code, e.g. 415 — not the +1 country code" />
          <button className="primary voice" onClick={searchNumbers}>Search</button>
        </div>
        <p className="hint" style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 16px' }}>
          The Country dropdown above already covers the country code — this
          field is just the local area code (e.g. 415), and can be left
          blank to search the whole country.
        </p>

        {searchResults === 'loading' && <p style={{ color: 'var(--muted)' }}>Searching…</p>}
        {searchError && <p style={{ color: 'var(--danger)' }}>{searchError}</p>}
        {Array.isArray(searchResults) && searchResults.length === 0 && <p style={{ color: 'var(--muted)' }}>No numbers found for that search.</p>}
        {Array.isArray(searchResults) && searchResults.map((r) => (
          <div className="credential" key={r.phoneNumber}>
            <div className="row">
              <span>{r.friendlyName}</span>
              <button className="primary voice" onClick={() => provisionNumber(r.phoneNumber)}>Buy this number</button>
            </div>
          </div>
        ))}

        {provisionResult?.loading && <p style={{ color: 'var(--muted)' }}>Preparing checkout…</p>}
        {provisionResult?.redirecting && <p style={{ color: 'var(--muted)' }}>Redirecting to payment…</p>}
        {provisionResult?.error && <p style={{ color: 'var(--danger)' }}>{provisionResult.error}</p>}
      </div>

      <div className="panel-box">
        <h2>Your phone numbers</h2>
        <table>
          <thead><tr><th>Number</th><th>Label</th><th>SIP username</th><th>Provisioned</th><th></th></tr></thead>
          <tbody>
            {numbers.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>No numbers yet</td></tr>
            ) : numbers.map((n) => (
              <tr key={n.id}>
                <td className="mono">{n.phoneNumber}</td>
                <td>{n.customerLabel || '—'}</td>
                <td className="mono">{n.sipSetup.username}</td>
                <td>{new Date(n.provisionedAt).toLocaleString()}</td>
                <td><button className="danger" onClick={() => releaseNumber(n.id)}>Release</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>SIP trunk</h2>
        <p className="subtitle" style={{ marginBottom: 16 }}>
          Every number on your account shares one dedicated trunk. Inbound calls
          only reach a device once you set an origination address below — a
          softphone with no fixed public address can't just "register" here;
          see the note under the form.
        </p>

        {trunkError && <p style={{ color: 'var(--danger)' }}>{trunkError}</p>}
        {!trunk && !trunkError && <p style={{ color: 'var(--muted)' }}>No trunk yet — provision a number first.</p>}
        {trunk && (
          <div className="credential">
            <div className="row"><span>SIP domain</span><span className="value">{trunk.domainName}</span></div>
            <div className="row"><span>SIP username</span><span className="value">{trunk.sipUsername}</span></div>
            <div className="row"><span>Origination address</span><span className="value">{trunk.originationUri || 'not set'}</span></div>
          </div>
        )}

        <div className="form-row" style={{ marginTop: 16 }}>
          <input value={originationUri} onChange={(e) => setOriginationUri(e.target.value)} placeholder="sip:203.0.113.10:5060" style={{ flex: 1, minWidth: 240 }} />
          <button className="primary voice" onClick={setTrunkOrigination}>Set origination address</button>
        </div>
        <p className="hint" style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 16px' }}>
          This must be the public SIP address of a PBX, session border controller,
          or a softphone with a stable, reachable address — Twilio's trunk API
          cannot accept a plain SIP REGISTER from an arbitrary device.
        </p>

        <button className="danger" onClick={resetTrunkPassword}>Reset SIP password</button>

        {trunkResult?.loading && <p style={{ color: 'var(--muted)' }}>Setting…</p>}
        {trunkResult?.error && <p style={{ color: 'var(--danger)' }}>{trunkResult.error}</p>}
        {trunkResult?.success && <p style={{ color: 'var(--mail)' }}>{trunkResult.success}</p>}
        {trunkResult?.passwordReset && (
          <>
            <div className="credential">
              <div className="row"><span>New SIP username</span><span className="value">{trunkResult.passwordReset.trunk.sipUsername}</span></div>
              <div className="row"><span>New SIP password</span><span className="value">{trunkResult.passwordReset.password}</span></div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>Save this now — it will not be shown again.</p>
          </>
        )}
      </div>
    </div>
  );
}
