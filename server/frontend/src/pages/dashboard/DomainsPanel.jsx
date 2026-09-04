import { useState, useEffect, useCallback } from 'react';
import { redirectToPayfastCheckout } from '../../lib/payfastCheckout';

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
    const trimmed = searchInput.trim();
    if (!trimmed) { setSearchResult({ error: 'Enter a domain name.' }); return; }
    if (!trimmed.includes('.')) {
      setSearchResult({
        error: `"${trimmed}" needs an extension to be a real domain — try "${trimmed}.com" (or .co.za, .net, etc). Domain registries check availability by the full name, extension included.`
      });
      return;
    }
    setSearchResult({ loading: true });
    setQuote(null);
    setRegisterResult(null);
    try {
      const res = await authedFetch(`/api/domains/search?domain=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) { setSearchResult({ error: data.error }); return; }
      if (!data.available) { setSearchResult({ unavailable: true, domain: trimmed }); return; }
      setSearchResult({ available: true, domain: trimmed });
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
  }  async function confirmDomainRegister() {
    const requiredTypes = (quote.data.requiredAgreements || []).map((a) => a.agreementType);
    const uncheckedExists = requiredTypes.some((t) => !agreed[t]);
    if (uncheckedExists) {
      alert('Please agree to every listed agreement before continuing.');
      return;
    }
    if (!confirm(`Continue to payment for ${quote.domain}? You'll be redirected to complete checkout.`)) return;

    setRegisterResult({ loading: true });
    try {
      const res = await authedFetch('/api/domains/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: quote.domain, period: 1, agreedAgreementTypes: requiredTypes })
      });
      const data = await res.json();
      if (!res.ok) { setRegisterResult({ error: data.error }); return; }
      setRegisterResult({ redirecting: true });
      redirectToPayfastCheckout(data.payfastUrl, data.checkoutFields);
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
        Search, price, and register a domain. Once you complete payment,
        registration is submitted immediately and cannot be undone or
        refunded — review the price and every listed agreement before
        confirming.
      </p>

      {health?.domainsConfigured ? (
        <div className="status-banner ok">Connected and ready.</div>
      ) : (
        <div className="status-banner warn">Not configured yet — contact support to get this feature enabled on your account.</div>
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
                <span className="value">Available</span>
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
              <div className="row"><span>Price</span><span className="value">{quote.data.customerPriceFormatted}</span></div>
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
            <button className="danger" style={{ marginTop: 10 }} onClick={confirmDomainRegister}>Continue to payment</button>
            <p className="hint" style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>You'll be redirected to complete payment securely.</p>

            {registerResult?.loading && <p style={{ color: 'var(--muted)' }}>Preparing checkout…</p>}
            {registerResult?.redirecting && <p style={{ color: 'var(--muted)' }}>Redirecting to payment…</p>}
            {registerResult?.error && <p style={{ color: 'var(--danger)' }}>{registerResult.error}</p>}
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
              Adding a record that already exists (same type/name/value) will be rejected —
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
