import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useRequireAuth, useAuthedFetch } from '../../lib/useAuthedFetch';
import '../../styles/global.css';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~1 minute of polling before giving up and asking them to check the dashboard

const STATUS_COPY = {
  pending: { title: 'Confirming your payment…', tone: 'muted', body: "This usually takes a few seconds. Don't close this page yet." },
  paid: { title: 'Payment received — finishing up…', tone: 'muted', body: 'Your order is being processed now.' },
  fulfilled: { title: 'All done!', tone: 'ok', body: 'Your order is complete.' },
  failed: { title: 'Payment did not go through', tone: 'danger', body: "You haven't been charged. You can try again from the dashboard." },
  amount_mismatch: { title: 'Something looked wrong with this payment', tone: 'danger', body: "We've flagged this for review rather than completing it automatically. Contact support with your order reference below." },
  fulfillment_failed: { title: 'Payment received, but something went wrong', tone: 'danger', body: "Your payment succeeded but we couldn't finish setting this up automatically. We've been notified and will follow up — contact support with your order reference below if you don't hear from us soon." }
};

export default function CheckoutReturn() {
  useRequireAuth();
  const authedFetch = useAuthedFetch();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!orderId) { setError('No order reference in the URL.'); return; }
    let cancelled = false;
    let timer;

    async function poll() {
      try {
        const res = await authedFetch(`/api/payments/orders/${orderId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(data.error); return; }
        setOrder(data);

        pollCount.current += 1;
        if ((data.status === 'pending' || data.status === 'paid') && pollCount.current < MAX_POLLS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    poll();

    return () => { cancelled = true; clearTimeout(timer); };
  }, [orderId, authedFetch]);

  const copy = order ? (STATUS_COPY[order.status] || STATUS_COPY.pending) : null;
  const stillWaiting = order && (order.status === 'pending' || order.status === 'paid') && pollCount.current >= MAX_POLLS;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 24 }}>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {!error && !order && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {!error && order && (
        <>
          <h1 style={{ fontSize: 22 }}>{copy.title}</h1>
          <p style={{ color: 'var(--muted)', maxWidth: 420 }}>{copy.body}</p>
          {stillWaiting && (
            <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 420 }}>
              This is taking longer than usual — check the dashboard in a few minutes, or contact support with your order reference below.
            </p>
          )}
          <p className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>Order reference: {order.id}</p>
        </>
      )}

      <Link to="/dashboard" className="primary" style={{ padding: '10px 20px', textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>Back to dashboard</Link>
    </div>
  );
}
