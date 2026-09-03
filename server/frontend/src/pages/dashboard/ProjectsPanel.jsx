import { useState, useEffect, useCallback } from 'react';

const HINTS = {
  website: 'Describe what you need — pages, purpose, examples you like',
  software: 'Describe what you need — the problem it solves, who uses it',
  internet: 'Describe what you need — installation address, preferred provider (e.g. Rain), current connection if any'
};

const STATUSES = ['Requested', 'In Progress', 'Delivered', 'Cancelled'];

export default function ProjectsPanel({ authedFetch }) {
  const [type, setType] = useState('website');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [createResult, setCreateResult] = useState(null);
  const [projects, setProjects] = useState([]);

  const loadProjects = useCallback(async () => {
    try {
      const res = await authedFetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  async function createProject() {
    if (!title.trim() || !description.trim()) { setCreateResult({ error: 'Title and description are required.' }); return; }
    setCreateResult({ loading: true });
    try {
      const res = await authedFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: title.trim(), description: description.trim(), budget: budget.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) { setCreateResult({ error: data.error }); return; }
      setCreateResult({ success: true });
      setTitle(''); setDescription(''); setBudget('');
      loadProjects();
    } catch (err) {
      setCreateResult({ error: err.message });
    }
  }

  async function updateStatus(id, status) {
    try {
      const res = await authedFetch(`/api/projects/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to update status');
      }
      loadProjects();
    } catch (err) { alert(err.message); }
  }

  async function deleteProject(id) {
    if (!confirm('Delete this request?')) return;
    try {
      const res = await authedFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete');
        return;
      }
      loadProjects();
    } catch (err) { alert(err.message); }
  }

  return (
    <div>
      <h1>Website, software &amp; internet services</h1>
      <p className="subtitle">
        Submit a request and track it through to delivery. This is a request
        tracker, not an automated build or provisioning service — a real
        person (or a real ISP partner, for internet connectivity) handles
        the actual work.
      </p>

      <div className="panel-box">
        <h2>New request</h2>
        <div className="form-row">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="website">Website</option>
            <option value="software">Software development</option>
            <option value="internet">Internet service (e.g. Rain, fibre, fixed wireless)</option>
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" style={{ flex: 1, minWidth: 180 }} />
        </div>
        <div className="form-row">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={HINTS[type]}
            style={{ flex: 1, minWidth: 260, background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--text)', padding: '10px 12px', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }}
          />
        </div>
        <div className="form-row">
          <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget (optional), e.g. R15,000" style={{ flex: 1, minWidth: 180 }} />
        </div>
        <button className="primary" onClick={createProject}>Submit request</button>
        {createResult?.loading && <p style={{ color: 'var(--muted)' }}>Submitting…</p>}
        {createResult?.error && <p style={{ color: 'var(--danger)' }}>{createResult.error}</p>}
        {createResult?.success && <p style={{ color: 'var(--mail)' }}>Request submitted.</p>}
      </div>

      <div className="panel-box">
        <h2>Your requests</h2>
        <table>
          <thead><tr><th>Title</th><th>Type</th><th>Budget</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {projects.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>No requests yet</td></tr>
            ) : projects.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{p.type}</td>
                <td>{p.budget || '—'}</td>
                <td>
                  <select value={p.status} onChange={(e) => updateStatus(p.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td><button className="danger" onClick={() => deleteProject(p.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
