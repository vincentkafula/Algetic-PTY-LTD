'use client';

import { useState } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Public version of the dashboard's domain search — deliberately usable
// without an account, so a visitor can check whether their business name
// is available before ever signing up (matching how GoDaddy's own public
// search works). Calls the same /api/domains/search and
// /api/domains/suggestions endpoints the dashboard panel uses — both were
// made public (rate-limited per IP instead of requiring login) specifically
// for this. Registering still requires an account — every "Get it" here
// leads to /login, not a payment flow, since actually charging someone
// for a domain is exactly the point where an account should exist.
// ---------------------------------------------------------------------------

export default function DomainSearchArea() {
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any>(null);

  async function searchDomain() {
    const trimmed = searchInput.trim();
    if (!trimmed) { setSearchResult({ error: 'Enter a business name or domain.' }); return; }

    setSuggestions('loading');

    if (trimmed.includes('.')) {
      setSearchResult({ loading: true });
      try {
        const res = await fetch(`/api/domains/search?domain=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!res.ok) { setSearchResult({ error: data.error }); }
        else if (!data.available) { setSearchResult({ unavailable: true, domain: trimmed }); }
        else { setSearchResult({ available: true, domain: trimmed, prices: data.prices }); }
      } catch (err: any) {
        setSearchResult({ error: err.message });
      }
    } else {
      setSearchResult(null);
    }

    try {
      const keyword = trimmed.includes('.') ? trimmed.split('.')[0] : trimmed;
      const res = await fetch(`/api/domains/suggestions?query=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      if (!res.ok) { setSuggestions({ error: data.error }); return; }
      setSuggestions({ items: data.items || [] });
    } catch (err: any) {
      setSuggestions({ error: err.message });
    }
  }

  return (
    <section className="service_area section-padding">
      <div className="container">
        <div className="section-title text-center" style={{ marginBottom: 40 }}>
          <span>Domain search</span>
          <h2>Find your business name online</h2>
          <p style={{ maxWidth: 560, margin: '12px auto 0' }}>
            Search free, no account needed. Create an account only when you're ready to register.
          </p>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-8 col-sm-12 col-xs-12">
            <div className="form-row">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchDomain(); }}
                placeholder="Your business name, or a full domain like example.com"
                style={{ flex: 1, minWidth: 240, padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(35,44,77,0.15)' }}
              />
              <button className="btn_one" onClick={searchDomain}>Search domains</button>
            </div>

            {searchResult?.loading && <p style={{ color: '#5B6180', marginTop: 16 }}>Checking…</p>}
            {searchResult?.error && <p style={{ color: '#e74c3c', marginTop: 16 }}>{searchResult.error}</p>}
            {searchResult?.unavailable && <p style={{ color: '#e74c3c', marginTop: 16 }}>{searchResult.domain} is not available.</p>}
            {searchResult?.available && (
              <div className="single_service" style={{ marginTop: 20, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{searchResult.domain}</strong>
                  <span style={{ color: '#0196E7', fontWeight: 700 }}>Available</span>
                </div>
                {(searchResult.prices || []).slice(0, 1).map((p: any) => (
                  <p key={p.term + p.period} style={{ margin: '10px 0 0' }}>Indicative price ({p.period} yr): <strong>{p.customerPriceFormatted}</strong></p>
                ))}
                <Link href="/login" className="btn_one" style={{ marginTop: 14, display: 'inline-block' }}>Create an account to register</Link>
              </div>
            )}

            {suggestions === 'loading' && <p style={{ color: '#5B6180', marginTop: 16 }}>Finding suggestions…</p>}
            {suggestions?.error && <p style={{ color: '#e74c3c', marginTop: 16 }}>{suggestions.error}</p>}
            {suggestions?.items && suggestions.items.length === 0 && <p style={{ color: '#5B6180', marginTop: 16 }}>No suggestions found for that search.</p>}
            {suggestions?.items && suggestions.items.length > 0 && (
              <>
                <p style={{ color: '#5B6180', fontSize: 13, margin: '24px 0 12px' }}>Suggested domains, all available now:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {suggestions.items.map((item: any) => (
                    <div className="single_service" key={item.domain} style={{ textAlign: 'left' }}>
                      <span style={{ fontWeight: 700, display: 'block' }}>{item.domain}</span>
                      {item.customerPriceFormatted && <span style={{ color: '#5B6180', display: 'block', margin: '6px 0 12px' }}>{item.customerPriceFormatted}</span>}
                      <Link href="/login" className="btn_one" style={{ width: '100%', textAlign: 'center', display: 'block' }}>Get it</Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
