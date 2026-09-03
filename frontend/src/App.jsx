import { Routes, Route } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import WebmailLogin from './pages/webmail/WebmailLogin.jsx';
import WebmailInbox from './pages/webmail/WebmailInbox.jsx';
import './styles/global.css';

function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>Page not found</h1>
      <p style={{ color: 'var(--muted)' }}>That page doesn't exist.</p>
      <Link to="/" className="primary" style={{ padding: '10px 20px', textDecoration: 'none', display: 'inline-block' }}>Back to Altegic</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/webmail-login" element={<WebmailLogin />} />
      <Route path="/webmail" element={<WebmailInbox />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
