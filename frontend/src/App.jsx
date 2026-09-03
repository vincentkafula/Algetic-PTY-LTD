import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import WebmailLogin from './pages/webmail/WebmailLogin.jsx';
import WebmailInbox from './pages/webmail/WebmailInbox.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/webmail-login" element={<WebmailLogin />} />
      <Route path="/webmail" element={<WebmailInbox />} />
    </Routes>
  );
}
