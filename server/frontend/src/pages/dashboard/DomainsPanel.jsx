import { useState, useEffect, useCallback } from 'react';

export default function DomainsPanel({ authedFetch, health }) {
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [quote, setQuote] = useState(null);
  const [agreed, setAgreed] = useState({});
  const [registerResult, setRegisterResult] = useState(null);
  const [domains, setDomains] = useState([]);

  const [dnsDomainId, setDnsDomainId] = useState('');
  const [dnsRecords, setDnsRecords] = useState([]);
  const [dnsError, setDnsError] = useState(null);
  const [dnsType, setDnsType] = useState('A');
  const [dnsName, setDnsName] = useState('');
  const [dnsData, setDnsData] = useState('');
  const [dnsTtl, setDnsTtl] = useState('');
  const [dnsResult, setDnsResult] = useState(null);

  const loadDomains = useCallback(async () => {
    try {
      const res = await authedFetch('/api/domains');
      const data = await res.json();
      setDomains(data.domains || []);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { loadDomains(); }, [loadDomains]);

  const loadDnsRecords = useCallback(async (domainId) => {
    if (!domainId) { setDnsRecords([]); setDnsError(null); return; }
    try {
      const res = await authedFetch(`/api/domains/${domainId}/dns`);
      const data = await res.json();
      if (!res.ok) { setDnsError(data.error); setDnsRecords([]); return; }
      setDnsError(null);
      setDnsRecords(Array.isArray(data) ? data : (data.records || []));
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { loadDnsRecords(dnsDomainId); }, [dnsDomainId, loadDnsRecords]);

  async function searchDomain() {
    if (!searchInput.trim()) { setSearchResult({ error: 'Enter a domain name.' }); return; }
    setSearchResult({ loading: true });
    setQuote(null);
    setRegisterResult(null);
    try {
      const res = await authedFetch(`/api/domains/search?domain=${encodeURIComponent(searchInput.trim())}`);
      const data = await res.json();
      if (!res.ok) { setSearchResult({ error: data.error }); return; }
      if (!data.available) { setSearchResult({ unavailable: true, domain: searchInput.trim() }); return; }
      setSearchResult({ available: true, domain: searchInput.trim(), prices: data.prices });
    } catch (err) {
      setSearchResult({ error: err.message });
    }
  }

  async function getDomainQuote(domain) {
    setQuote({ loading: true });
    try {
      const res = await authedFetch('/api/domains/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, period: 1 })
      });
      const data = await res.json();
      if (!res.ok) { setQuote({ error: data.error }); return; }
      setQuote({ data, domain });
      setAgreed({});
    } catch (err) {
      setQuote({ error: err.message });
    }
  }

  async function confirmDomainRegister() {
    const requiredTypes = (quote.data.requiredAgreements || []).map((a) => a.agreementType);
    const uncheckedExists = requiredTypes.some((t) => !agreed[t]);
    if (uncheckedExists) {
      alert('Please agree to every listed agreement before registering.');
      return;
    }
    if (!confirm(`Register ${quote.domain} now? This charges your GoDaddy account and cannot be undone.`)) return;

    setRegisterResult({ loading: true });
    try {
      const res = await authedFetch('/api/domains/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: quote.domain, quoteToken: quote.data.quoteToken, period: 1, agreedAgreementTypes: requiredTypes })
      });
      const data = await res.json();
      if (!res.ok) { setRegisterResult({ error: data.error }); return; }
      setRegisterResult({ success: `Registration submitted — status: ${data.status}.` });
      loadDomains();
    } catch (err) {
      setRegisterResult({ error: err.message });
    }
  }

  async function refreshDomainStatus(id) {
    try {
      await authedFetch(`/api/domains/${id}/status`);
      loadDomains();
    } catch (err) { alert(err.message); }
  }

  async function addDnsRecord() {
    if (!dnsDomainId) { setDnsResult({ error: 'Select a domain first.' }); return; }
    if (!dnsName.trim() || !dnsData.trim()) { setDnsResult({ error: 'Name and value are required.' }); return; }
    setDnsResult({ loading: true });
    try {
      const res = await authedFetch(`/api/domains/${dnsDomainId}/dns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: dnsType, name: dnsName.trim(), data: dnsData.trim(), ttl: dnsTtl.trim() ? parseInt(dnsTtl.trim(), 10) : undefined })
      });
      const responseData = await res.json();
      if (!res.ok) { setDnsResult({ error: responseData.error }); return; }
      setDnsResult({ success: 'Record added.' });
      setDnsName(''); setDnsData(''); setDnsTtl('');
      loadDnsRecords(dnsDomainId);
    } catch (err) {
      setDnsResult({ error: err.message });
    }
  }

  async function deleteDnsRecord(type, name) {
    if (!confirm(`Delete all ${type} records for "${name}"?`)) return;
    try {
      const res = await authedFetch(`/api/domains/${dnsDomainId}/dns/${type}/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete record');
        return;
      }
      loadDnsRecords(dnsDomainId);
    } catch (err) { alert(err.message); }
  }

  return (
    <div>
      <h1>Domain registration</h1>
      <p className="subtitle">
        Search, price, and register domains through GoDaddy. Registering a
        domain charges the connected GoDaddy account's payment method and
        cannot be undone — review the price and every listed agreement
        before confirming.
      </p>

      {health?.domainsConfigured ? (
        <div className="status-banner ok">Connected to GoDaddy.</div>
      ) : (
        <div className="status-banner warn">Not configured — set GODADDY_PAT in server/.env.</div>
      )}

      <div className="panel-box">
        <h2>Search</h2>
        <div className="form-row">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="example.com" style={{ flex: 1, minWidth: 200 }} />
          <button className="primary" onClick={searchDomain}>Check availability</button>
        </div>

        {searchResult?.loading && <p style={{ color: 'var(--muted)' }}>Checking…</p>}
        {searchResult?.error && <p style={{ color: 'var(--danger)' }}>{searchResult.error}</p>}
        {searchResult?.unavailable && <p style={{ color: 'var(--danger)' }}>{searchResult.domain} is not available.</p>}
        {searchResult?.available && (
          <>
            <div className="credential">
              <div className="row">
                <span>{searchResult.domain}</span>
                <span className="value">
                  Available {searchResult.prices?.[0] ? `$${(searchResult.prices[0].price.value / 100).toFixed(2)}/${searchResult.prices[0].period}yr` : ''}
                </span>
              </div>
            </div>
            <button className="primary" style={{ marginTop: 10 }} onClick={() => getDomainQuote(searchResult.domain)}>Get a price quote</button>
          </>
        )}

        {quote?.loading && <p style={{ color: 'var(--muted)' }}>Getting quote…</p>}
        {quote?.error && <p style={{ color: 'var(--danger)' }}>{quote.error}</p>}
        {quote?.data && (
          <>
            <div className="credential" style={{ marginTop: 10 }}>
              <div className="row"><span>Locked price</span><span className="value">${(quote.data.price.value / 100).toFixed(2)}</span></div>
              <div className="row"><span>Renewal price</span><span className="value">${(quote.data.renewalPrice.value / 100).toFixed(2)}/yr</span></div>
              <div className="row"><span>Quote expires</span><span className="value">{new Date(quote.data.expiresAt).toLocaleTimeString()}</span></div>
            </div>
            {(quote.data.requiredAgreements || []).map((a) => (
              <label key={a.agreementType} style={{ display: 'block', fontSize: 13, color: 'var(--muted)', margin: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={!!agreed[a.agreementType]}
                  onChange={(e) => setAgreed((prev) => ({ ...prev, [a.agreementType]: e.target.checked }))}
                />{' '}
                I agree to {a.title || a.agreementType}
                {a.url && <> (<a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mail)' }}>read</a>)</>}
              </label>
            ))}
            <button className="danger" style={{ marginTop: 10 }} onClick={confirmDomainRegister}>Register this domain now</button>
            <p className="hint" style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>This charges your connected GoDaddy account and cannot be undone.</p>

            {registerResult?.loading && <p style={{ color: 'var(--muted)' }}>Registering…</p>}
            {registerResult?.error && <p style={{ color: 'var(--danger)' }}>{registerResult.error}</p>}
            {registerResult?.success && <p style={{ color: 'var(--mail)' }}>{registerResult.success}</p>}
          </>
        )}
      </div>

      <div className="panel-box">
        <h2>Your domains</h2>
        <table>
          <thead><tr><th>Domain</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {domains.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>No domains yet</td></tr>
            ) : domains.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.domain}</td>
                <td>{d.status}</td>
                <td><button className="link-btn" onClick={() => refreshDomainStatus(d.id)}>Refresh status</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>DNS records</h2>
        <div className="form-row">
          <select value={dnsDomainId} onChange={(e) => setDnsDomainId(e.target.value)}>
            <option value="">Select a domain…</option>
            {domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}
          </select>
        </div>

        {dnsDomainId && (
          <div>
            <div className="form-row">
              <select value={dnsType} onChange={(e) => setDnsType(e.target.value)}>
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="TXT">TXT</option>
                <option value="MX">MX</option>
              </select>
              <input value={dnsName} onChange={(e) => setDnsName(e.target.value)} placeholder="Name, e.g. www or @ for root" />
              <input value={dnsData} onChange={(e) => setDnsData(e.target.value)} placeholder="Value, e.g. 192.0.2.10" style={{ flex: 1, minWidth: 180 }} />
              <input value={dnsTtl} onChange={(e) => setDnsTtl(e.target.value)} placeholder="TTL (default 600)" style={{ maxWidth: 120 }} />
            </div>
            <button className="primary voice" onClick={addDnsRecord}>Add record</button>
            <p className="hint" style={{ color: 'var(--muted)', fontSize: 12, margin: '6px 0 0' }}>
              Adding a record that already exists (same type/name/value) will be rejected by GoDaddy —
              use Delete then Add to change an existing record's value.
            </p>
          </div>
        )}

        {dnsResult?.loading && <p style={{ color: 'var(--muted)' }}>Adding…</p>}
        {dnsResult?.error && <p style={{ color: 'var(--danger)' }}>{dnsResult.error}</p>}
        {dnsResult?.success && <p style={{ color: 'var(--mail)' }}>{dnsResult.success}</p>}

        <table>
          <thead><tr><th>Type</th><th>Name</th><th>Value</th><th>TTL</th><th></th></tr></thead>
          <tbody>
            {!dnsDomainId ? (
              <tr className="empty-row"><td colSpan={5}>Select a domain above</td></tr>
            ) : dnsError ? (
              <tr className="empty-row"><td colSpan={5}>{dnsError}</td></tr>
            ) : dnsRecords.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>No DNS records yet</td></tr>
            ) : dnsRecords.map((r) => (
              <tr key={`${r.type}-${r.name}`}>
                <td>{r.type}</td>
                <td className="mono">{r.name}</td>
                <td className="mono">{r.data}</td>
                <td>{r.ttl}</td>
                <td><button className="danger" onClick={() => deleteDnsRecord(r.type, r.name)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
