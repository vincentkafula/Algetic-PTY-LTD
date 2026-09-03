import { useState, useEffect, useCallback } from 'react';
import '../../styles/webmailInbox.css';
import { wmGetAddress, wmClearSession } from '../../lib/webmailApi';
import { useRequireWebmailSession, useWebmailAuthedFetch } from '../../lib/useWebmailAuthedFetch';

const FOLDER_LABELS = { inbox: 'Inbox', starred: 'Starred', sent: 'Sent', spam: 'Spam', trash: 'Trash' };
const FOLDERS = ['inbox', 'starred', 'sent', 'spam', 'trash'];

export default function WebmailInbox() {
  useRequireWebmailSession();
  const authedFetch = useWebmailAuthedFetch();

  const [folder, setFolder] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  // view: 'list' | 'read' | 'compose'
  const [view, setView] = useState('list');
  const [openMessage, setOpenMessage] = useState(null);

  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeResult, setComposeResult] = useState(null);

  const loadFolder = useCallback(async (f) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authedFetch(`/api/webmail/messages?folder=${f}`);
      const data = await res.json();
      if (!res.ok) { setLoadError(data.error); setMessages([]); return; }
      setMessages(data.messages || []);
    } catch { /* redirected on 401 */ } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  const refreshCounts = useCallback(async () => {
    try {
      const res = await authedFetch('/api/webmail/messages?folder=inbox');
      const data = await res.json();
      setInboxCount((data.messages || []).length);
    } catch { /* non-critical */ }
  }, [authedFetch]);

  useEffect(() => { loadFolder(folder); }, [folder, loadFolder]);
  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  function switchFolder(f) {
    setFolder(f);
    setView('list');
    setOpenMessage(null);
  }

  async function toggleStar(id, starred) {
    try {
      await authedFetch(`/api/webmail/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred })
      });
      loadFolder(folder);
    } catch { /* redirected on 401 */ }
  }

  function openMessageView(msg) {
    setOpenMessage(msg);
    setView('read');
  }

  function backToList() {
    setView('list');
    setOpenMessage(null);
  }

  async function moveMessage(id, targetFolder) {
    try {
      await authedFetch(`/api/webmail/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: targetFolder })
      });
      backToList();
      loadFolder(folder);
      refreshCounts();
    } catch { /* redirected on 401 */ }
  }

  async function deleteMessageForever(id) {
    if (!confirm('Delete this message permanently? This cannot be undone.')) return;
    try {
      await authedFetch(`/api/webmail/messages/${id}`, { method: 'DELETE' });
      backToList();
      loadFolder(folder);
    } catch { /* redirected on 401 */ }
  }

  function openCompose() {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeResult(null);
    setView('compose');
  }

  function startReply(msg) {
    setComposeTo(msg.from);
    setComposeSubject(msg.subject.startsWith('Re: ') ? msg.subject : `Re: ${msg.subject}`);
    setComposeBody('');
    setComposeResult(null);
    setView('compose');
  }

  function cancelCompose() {
    setView('list');
  }

  async function sendMessage() {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setComposeResult({ error: 'To, subject, and message are all required.' });
      return;
    }
    setComposeResult({ loading: true });
    try {
      const res = await authedFetch('/api/webmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: composeTo.trim(), subject: composeSubject.trim(), text: composeBody.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setComposeResult({ error: data.error }); return; }
      setComposeResult({ success: true });
      setTimeout(() => { switchFolder('sent'); }, 600);
    } catch (err) {
      setComposeResult({ error: err.message });
    }
  }

  function logout() {
    wmClearSession();
    window.location.href = '/webmail-login';
  }

  return (
    <div className="wm-app">
      <div className="wm-sidebar">
        <div className="wm-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mail)" strokeWidth="1.8"><path d="M12 2.5l7.5 3.2v5.1c0 4.6-3.2 8.4-7.5 9.7-4.3-1.3-7.5-5.1-7.5-9.7V5.7L12 2.5z" /></svg>
          Altegic Mail
        </div>
        <button className="wm-compose-btn" onClick={openCompose}>✎ Compose</button>
        {FOLDERS.map((f) => (
          <div key={f} className={`wm-folder-link ${folder === f ? 'active' : ''}`} onClick={() => switchFolder(f)}>
            {FOLDER_LABELS[f]}
            {f === 'inbox' && <span className="badge">{inboxCount}</span>}
          </div>
        ))}
        <div className="wm-sidebar-footer">
          <div className="addr">{wmGetAddress()}</div>
          <button className="link-btn" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="wm-main">
        {view === 'list' && (
          <div>
            <h1>{FOLDER_LABELS[folder]}</h1>
            {loading ? (
              <div className="wm-empty">Loading…</div>
            ) : loadError ? (
              <div className="wm-empty">{loadError}</div>
            ) : messages.length === 0 ? (
              <div className="wm-empty">No messages in {FOLDER_LABELS[folder]}</div>
            ) : (
              <div>
                {messages.map((m) => (
                  <div className="wm-msg-row" key={m.id} onClick={() => openMessageView(m)}>
                    <span
                      className={`wm-star ${m.starred ? 'on' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleStar(m.id, !m.starred); }}
                    >★</span>
                    <span className="wm-msg-from">{m.direction === 'inbound' ? m.from : `To: ${m.to}`}</span>
                    <span className="wm-msg-subject">{m.subject}</span>
                    <span className="wm-msg-time">{new Date(m.at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'read' && openMessage && (
          <div>
            <button className="link-btn" onClick={backToList}>← Back</button>
            <div className="wm-read-header" style={{ marginTop: 14 }}>
              <div>
                <h2>{openMessage.subject}</h2>
                <div className="wm-read-meta">
                  <span>{openMessage.direction === 'inbound' ? 'From' : 'To'}</span>: <strong>{openMessage.direction === 'inbound' ? openMessage.from : openMessage.to}</strong>
                </div>
                <div className="wm-read-meta">{new Date(openMessage.at).toLocaleString()}</div>
              </div>
            </div>
            <div className="wm-read-body">{openMessage.bodyText || '(no content)'}</div>
            <div className="wm-read-actions">
              {openMessage.direction === 'inbound' && (
                <button className="primary" onClick={() => startReply(openMessage)}>Reply</button>
              )}
              {openMessage.folder !== 'spam' && (
                <button className="link-btn" onClick={() => moveMessage(openMessage.id, 'spam')}>Mark as spam</button>
              )}
              {openMessage.folder !== 'trash' ? (
                <button className="danger" onClick={() => moveMessage(openMessage.id, 'trash')}>Move to trash</button>
              ) : (
                <>
                  <button className="danger" onClick={() => deleteMessageForever(openMessage.id)}>Delete forever</button>
                  <button className="link-btn" onClick={() => moveMessage(openMessage.id, 'inbox')}>Move to inbox</button>
                </>
              )}
            </div>
          </div>
        )}

        {view === 'compose' && (
          <div className="panel-box">
            <h2>New message</h2>
            <div className="form-row">
              <input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="To: recipient@example.com" style={{ flex: 1, minWidth: 240 }} />
            </div>
            <div className="form-row">
              <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject" style={{ flex: 1, minWidth: 240 }} />
            </div>
            <div className="form-row">
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={8}
                placeholder="Write your message…"
                style={{ flex: 1, minWidth: 260, background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--text)', padding: '12px 14px', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }}
              />
            </div>
            <button className="primary" onClick={sendMessage}>Send</button>
            <button className="link-btn" onClick={cancelCompose} style={{ marginLeft: 14 }}>Cancel</button>
            <div style={{ marginTop: 10 }}>
              {composeResult?.loading && <p style={{ color: 'var(--muted)' }}>Sending…</p>}
              {composeResult?.error && <p style={{ color: 'var(--danger)' }}>{composeResult.error}</p>}
              {composeResult?.success && <p style={{ color: 'var(--mail)' }}>Sent.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
