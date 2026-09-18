'use client';

import { useState, useEffect, useCallback } from 'react';

function fmtNum(n: any) {
  return typeof n === 'number' ? n.toLocaleString() : n;
}

export default function AdminPanel({ authedFetch }: { authedFetch: any }) {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, u, o] = await Promise.all([
        authedFetch('/api/admin/stats'),
        authedFetch('/api/admin/users'),
        authedFetch('/api/admin/orders')
      ]);
      if (!s.ok || !u.ok || !o.ok) {
        setError('Your account does not have access to the management dashboard.');
        return;
      }
      setStats(await s.json());
      setUsers((await u.json()).users || []);
      setOrders((await o.json()).orders || []);
    } catch (err: any) {
      setError(err.message);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div>
        <h1>Altegic management</h1>
        <div className="status-banner warn">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <h1>Altegic management</h1>
      <p className="subtitle">A platform-wide business overview — every account, every order, at a glance.</p>

      <div className="stat-grid">
        {stats ? [
          ['Total accounts', fmtNum(stats.totalUsers)],
          ['Total orders', fmtNum(stats.totalOrders)],
          ['Total revenue', stats.totalRevenueFormatted],
          ['Mailboxes', fmtNum(stats.totalMailboxes)],
          ['Phone numbers', fmtNum(stats.totalNumbers)],
          ['Domains', fmtNum(stats.totalDomains)],
          ['Projects', fmtNum(stats.totalProjects)]
        ].map(([lbl, num]) => (
          <div className="cell" key={lbl as string}><div className="num">{num}</div><div className="lbl">{lbl}</div></div>
        )) : <div className="cell"><div className="num">—</div><div className="lbl">Loading…</div></div>}
      </div>

      <div className="panel-box">
        <h2>Accounts by role</h2>
        {stats ? (
          <div className="credential">
            {Object.entries(stats.usersByRole).map(([role, count]) => (
              <div className="row" key={role}><span>{role}</span><span className="value">{fmtNum(count as number)}</span></div>
            ))}
          </div>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>

      <div className="panel-box">
        <h2>Orders by status</h2>
        {stats ? (
          <div className="credential">
            {Object.entries(stats.ordersByStatus).length === 0 ? (
              <div className="row"><span>No orders yet</span></div>
            ) : Object.entries(stats.ordersByStatus).map(([status, count]) => (
              <div className="row" key={status}><span>{status}</span><span className="value">{fmtNum(count as number)}</span></div>
            ))}
          </div>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>

      <div className="panel-box">
        <h2>All accounts</h2>
        <table>
          <thead><tr><th>Email</th><th>Company</th><th>Role</th><th>Created</th></tr></thead>
          <tbody>
            {users.length === 0 ? (
              <tr className="empty-row"><td colSpan={4}>No accounts yet</td></tr>
            ) : users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.companyName || '—'}</td>
                <td><span className={`status-pill ${u.role}`}>{u.role}</span></td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>All orders</h2>
        <table>
          <thead><tr><th>Item</th><th>Account</th><th>Status</th><th>Price</th><th>Margin</th><th>Created</th></tr></thead>
          <tbody>
            {orders.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>No orders yet</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id}>
                <td>{o.itemName}</td>
                <td>{o.ownerEmail}</td>
                <td><span className={`status-pill ${o.status}`}>{o.status}</span></td>
                <td>R{(o.customerZarCents / 100).toFixed(2)}</td>
                <td>{o.markupPercent}%</td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
