import { Link } from 'react-router-dom';
import '../../styles/global.css';

export default function CheckoutCancel() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>Checkout cancelled</h1>
      <p style={{ color: 'var(--muted)', maxWidth: 420 }}>You haven't been charged. You can pick up where you left off from the dashboard whenever you're ready.</p>
      <Link to="/dashboard" className="primary" style={{ padding: '10px 20px', textDecoration: 'none', display: 'inline-block' }}>Back to dashboard</Link>
    </div>
  );
}
