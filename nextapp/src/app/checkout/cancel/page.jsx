import Link from 'next/link';
import '@/styles/dashboard.css';

export default function CheckoutCancelPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>Checkout cancelled</h1>
      <p style={{ color: 'var(--muted)', maxWidth: 420 }}>You haven't been charged. You can pick up where you left off from the dashboard whenever you're ready.</p>
      <Link href="/dashboard" className="primary" style={{ padding: '10px 20px', textDecoration: 'none', display: 'inline-block' }}>Back to dashboard</Link>
    </div>
  );
}
