import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      {/* /dashboard, /webmail-login, /webmail are the next phase of this
          conversion — not wired up yet, see README/conversation notes. */}
    </Routes>
  );
}
