'use client';

import { useState, useEffect, useCallback } from 'react';

function fmtNum(n) {
  return typeof n === 'number' ? n.toLocaleString() : n;
}

export default function MvnoPanel({ authedFetch }) {
  const [kpis, setKpis] = useState(null);
  const [towers, setTowers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [fraud, setFraud] = useState([]);
  const [billing, setBilling] = useState(null);
  const [support, setSupport] = useState(null);
  const [roaming, setRoaming] = useState([]);
  const [traffic, setTraffic] = useState([]);
  const [plans, setPlans] = useState([]);
  const [simInventory, setSimInventory] = useState(null);
  const [porting, setPorting] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [incidents, setIncidents] = useState(null);

  const load = useCallback(async () => {
    try {
      const [k, t, s, f, b, sp, r, tr, pl, si, po, co, inc] = await Promise.all([
        authedFetch('/api/mvno/kpis'),
        authedFetch('/api/mvno/towers'),
        authedFetch('/api/mvno/subscribers'),
        authedFetch('/api/mvno/fraud-alerts'),
        authedFetch('/api/mvno/billing-summary'),
        authedFetch('/api/mvno/support-summary'),
        authedFetch('/api/mvno/roaming'),
        authedFetch('/api/mvno/traffic'),
        authedFetch('/api/mvno/plans'),
        authedFetch('/api/mvno/sim-inventory'),
        authedFetch('/api/mvno/porting'),
        authedFetch('/api/mvno/compliance'),
        authedFetch('/api/mvno/incidents')
      ]);
      setKpis((await k.json()).data);
      setTowers((await t.json()).data);
      setSubscribers((await s.json()).data);
      setFraud((await f.json()).data);
      setBilling((await b.json()).data);
      setSupport((await sp.json()).data);
      setRoaming((await r.json()).data);
      setTraffic((await tr.json()).data);
      setPlans((await pl.json()).data);
      setSimInventory((await si.json()).data);
      setPorting((await po.json()).data);
      setCompliance((await co.json()).data);
      setIncidents((await inc.json()).data);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  const kpiCells = kpis ? [
    ['Total subscribers', fmtNum(kpis.totalSubscribers)],
    ['Active subscribers', fmtNum(kpis.activeSubscribers)],
    ['Network uptime', kpis.networkUptimePct + '%'],
    ['Active data sessions', fmtNum(kpis.activeDataSessions)],
    ['Active voice calls', fmtNum(kpis.activeVoiceCalls)],
    ['Revenue today (ZAR)', 'R' + fmtNum(kpis.revenueTodayZAR)],
    ['Fraud alerts active', kpis.fraudAlertsActive],
    ['Towers online', `${kpis.towersOnline} / ${kpis.totalTowerCount}`]
  ] : null;

  const peakHour = traffic.length ? traffic.reduce((max, h) => (h.dataGB > max.dataGB ? h : max), traffic[0]) : null;

  return (
    <div>
      <h1>MVNO operations</h1>
      <p className="subtitle">
        A network operations center preview for a Mobile Virtual Network Operator business —
        subscriber base, towers, fraud, billing, and support, at a glance.
      </p>
      <div className="demo-banner">
        ⚠ DEMO DATA — every number on this page is simulated. There is no real telecom
        core network, no real subscribers, and no real cell towers behind this yet.
        Building the real thing requires an actual MVNE/MNO wholesale relationship.
      </div>

      <div className="stat-grid">
        {kpiCells ? kpiCells.map(([lbl, num]) => (
          <div className="cell" key={lbl}><div className="num">{num}</div><div className="lbl">{lbl}</div></div>
        )) : <div className="cell"><div className="num">—</div><div className="lbl">Loading…</div></div>}
      </div>

      <div className="panel-box">
        <h2>Network traffic (last 24 hours)</h2>
        {traffic.length === 0 ? <p style={{ color: 'var(--muted)' }}>Loading…</p> : (
          <>
            {peakHour && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>Peak hour: {peakHour.hour} — {peakHour.dataGB} GB</p>}
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Hour</th><th>Data (GB)</th><th>Voice (min)</th><th>SMS</th></tr></thead>
                <tbody>
                  {traffic.filter((_, i) => i % 2 === 0).map((h) => (
                    <tr key={h.hour}>
                      <td className="mono">{h.hour}</td>
                      <td>{h.dataGB}</td>
                      <td>{fmtNum(h.voiceMinutes)}</td>
                      <td>{fmtNum(h.smsCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="panel-box">
        <h2>Rate plans</h2>
        <table>
          <thead><tr><th>Plan</th><th>Type</th><th>Data</th><th>Voice</th><th>Price</th><th>Active subscribers</th><th>Revenue MTD</th></tr></thead>
          <tbody>
            {plans.length === 0 ? (
              <tr className="empty-row"><td colSpan={7}>Loading…</td></tr>
            ) : plans.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td><span className={`status-pill ${p.type}`}>{p.type}</span></td>
                <td>{p.dataGB === null ? 'Unlimited' : p.dataGB === 0 ? '—' : `${p.dataGB} GB`}</td>
                <td>{p.voiceMinutes === null ? 'Unlimited' : p.voiceMinutes === 0 ? '—' : `${p.voiceMinutes} min`}</td>
                <td>{p.priceZAR === 0 ? 'Pay as you go' : `R${p.priceZAR}`}</td>
                <td>{fmtNum(p.activeSubscribers)}</td>
                <td>R{fmtNum(p.revenueMTDZAR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>SIM & eSIM inventory</h2>
        {simInventory ? (
          <>
            <div className="credential" style={{ marginBottom: 16 }}>
              <div className="row"><span>Physical SIMs in stock</span><span className="value">{fmtNum(simInventory.totalPhysicalSims)}</span></div>
              <div className="row"><span>eSIM profiles available</span><span className="value">{fmtNum(simInventory.totalEsimProfiles)}</span></div>
              <div className="row"><span>Pending activations</span><span className="value">{fmtNum(simInventory.totalPendingActivations)}</span></div>
              {simInventory.lowStockRegions.length > 0 && (
                <div className="row"><span>Low stock in</span><span className="value" style={{ color: 'var(--danger)' }}>{simInventory.lowStockRegions.join(', ')}</span></div>
              )}
            </div>
            <table>
              <thead><tr><th>Region</th><th>Physical SIMs</th><th>eSIM profiles</th><th>Pending activations</th></tr></thead>
              <tbody>
                {simInventory.byRegion.map((r) => (
                  <tr key={r.region}>
                    <td>{r.region}</td>
                    <td style={r.physicalSimsInStock < 1500 ? { color: 'var(--danger)' } : undefined}>{fmtNum(r.physicalSimsInStock)}</td>
                    <td>{fmtNum(r.esimProfilesAvailable)}</td>
                    <td>{r.pendingActivations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>

      <div className="panel-box">
        <h2>Number porting (MNP)</h2>
        {porting ? (
          <>
            <div className="credential" style={{ marginBottom: 16 }}>
              <div className="row"><span>Pending requests</span><span className="value">{porting.pendingCount}</span></div>
              <div className="row"><span>Completed this month</span><span className="value">{fmtNum(porting.completedThisMonth)}</span></div>
            </div>
            <table>
              <thead><tr><th>ID</th><th>Direction</th><th>Other network</th><th>MSISDN</th><th>Status</th><th>Submitted</th></tr></thead>
              <tbody>
                {porting.requests.map((req) => (
                  <tr key={req.id}>
                    <td className="mono">{req.id}</td>
                    <td>{req.direction === 'porting_in' ? '↓ In' : '↑ Out'}</td>
                    <td>{req.otherNetwork}</td>
                    <td className="mono">{req.msisdn}</td>
                    <td><span className={`status-pill ${req.status}`}>{req.status.replace(/_/g, ' ')}</span></td>
                    <td>{new Date(req.submittedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>

      <div className="panel-box">
        <h2>RICA compliance</h2>
        {compliance ? (
          <div className="credential">
            <div className="row"><span>Active SIMs</span><span className="value">{fmtNum(compliance.totalActiveSims)}</span></div>
            <div className="row"><span>RICA registered</span><span className="value">{fmtNum(compliance.ricaRegisteredSims)} ({compliance.ricaRegisteredPct}%)</span></div>
            <div className="row"><span>Pending verification</span><span className="value">{fmtNum(compliance.pendingVerification)}</span></div>
            <div className="row"><span>Unregistered (at risk of suspension)</span><span className="value" style={{ color: 'var(--danger)' }}>{fmtNum(compliance.unregisteredAtRiskOfSuspension)}</span></div>
            <div className="row"><span>ICASA license status</span><span className="value">{compliance.icasaLicenseStatus}</span></div>
            <div className="row"><span>Last compliance audit</span><span className="value">{new Date(compliance.lastComplianceAuditDate).toLocaleDateString()}</span></div>
          </div>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>

      <div className="panel-box">
        <h2>Network incidents</h2>
        {incidents ? (
          <>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>{incidents.activeIncidents} active incident{incidents.activeIncidents === 1 ? '' : 's'}</p>
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Region</th><th>Status</th><th>Started</th></tr></thead>
              <tbody>
                {incidents.incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td className="mono">{inc.id}</td>
                    <td>{inc.type.replace(/_/g, ' ')}</td>
                    <td><span className={`status-pill ${inc.severity}`}>{inc.severity}</span></td>
                    <td>{inc.region}</td>
                    <td><span className={`status-pill ${inc.status}`}>{inc.status}</span></td>
                    <td>{new Date(inc.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>

      <div className="panel-box">
        <h2>Cell towers</h2>
        <table>
          <thead><tr><th>Tower</th><th>Region</th><th>Tech</th><th>Status</th><th>Load</th><th>Subscribers</th></tr></thead>
          <tbody>
            {towers.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>Loading…</td></tr>
            ) : towers.map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.name}</td>
                <td>{t.region}</td>
                <td>{t.technology}</td>
                <td><span className={`status-pill ${t.status}`}>{t.status}</span></td>
                <td>{t.loadPercent}%</td>
                <td>{fmtNum(t.connectedSubscribers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Subscribers (sample)</h2>
        <table>
          <thead><tr><th>MSISDN</th><th>Status</th><th>Plan</th><th>Data balance</th><th>Roaming</th></tr></thead>
          <tbody>
            {subscribers.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>Loading…</td></tr>
            ) : subscribers.map((s) => (
              <tr key={s.msisdn}>
                <td className="mono">{s.msisdn}</td>
                <td><span className={`status-pill ${s.status}`}>{s.status}</span></td>
                <td>{s.plan}</td>
                <td>{fmtNum(s.dataBalanceMB)} MB</td>
                <td>{s.roaming ? 'Yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Fraud alerts</h2>
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>MSISDN</th><th>Risk score</th><th>Detected</th></tr></thead>
          <tbody>
            {fraud.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>Loading…</td></tr>
            ) : fraud.map((f) => (
              <tr key={f.id}>
                <td className="mono">{f.id}</td>
                <td>{f.type.replace('_', ' ')}</td>
                <td><span className={`status-pill ${f.severity}`}>{f.severity}</span></td>
                <td className="mono">{f.msisdn}</td>
                <td>{f.riskScore}/10</td>
                <td>{new Date(f.detectedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Billing summary</h2>
        {billing ? (
          <div className="credential">
            <div className="row"><span>Revenue today</span><span className="value">R{fmtNum(billing.revenueTodayZAR)}</span></div>
            <div className="row"><span>Revenue month-to-date</span><span className="value">R{fmtNum(billing.revenueMTDZAR)}</span></div>
            <div className="row"><span>Invoices overdue</span><span className="value">{fmtNum(billing.invoicesOverdue)}</span></div>
            <div className="row"><span>Invoices paid</span><span className="value">{fmtNum(billing.invoicesPaid)}</span></div>
            <div className="row"><span>Avg revenue per user</span><span className="value">R{billing.avgRevenuePerUserZAR}</span></div>
          </div>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>

      <div className="panel-box">
        <h2>Support summary</h2>
        {support ? (
          <>
            <div className="credential">
              <div className="row"><span>Open tickets</span><span className="value">{fmtNum(support.openTickets)}</span></div>
              <div className="row"><span>Avg resolution time</span><span className="value">{support.avgResolutionHours}h</span></div>
              <div className="row"><span>CSAT score</span><span className="value">{support.csatScore}/5</span></div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
              {Object.entries(support.categories).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </p>
          </>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>

      <div className="panel-box">
        <h2>Roaming partners</h2>
        <table>
          <thead><tr><th>Network</th><th>Country</th><th>Status</th><th>Active roamers</th><th>30d revenue (USD)</th></tr></thead>
          <tbody>
            {roaming.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>Loading…</td></tr>
            ) : roaming.map((p) => (
              <tr key={p.networkName}>
                <td>{p.networkName}</td>
                <td>{p.country}</td>
                <td><span className={`status-pill ${p.status}`}>{p.status}</span></td>
                <td>{fmtNum(p.activeRoamers)}</td>
                <td>${fmtNum(p.revenue30dUSD)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
