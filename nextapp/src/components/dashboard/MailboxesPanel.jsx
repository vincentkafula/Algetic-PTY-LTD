'use client';

import { useState, useEffect, useCallback } from 'react';
import { redirectToPayfastCheckout } from '@/lib/payfastCheckout';

export default function MailboxesPanel({ authedFetch }) {
  const [localPart, setLocalPart] = useState('');
  const [forwardTo, setForwardTo] = useState('');
  const [createResult, setCreateResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [mailboxes, setMailboxes] = useState([]);

  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [messages, setMessages] = useState([]);
  const [msgTo, setMsgTo] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sendResult, setSendResult] = useState(null);
  const [sending, setSending] = useState(false);

  const loadMailboxes = useCallback(async () => {
    try {
      const res = await authedFetch('/api/mailboxes');
      const data = await res.json();
      setMailboxes(data.mailboxes || []);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { loadMailboxes(); }, [loadMailboxes]);

  const loadMessages = useCallback(async (mailboxId) => {
    if (!mailboxId) { setMessages([]); return; }
    try {
      const res = await authedFetch(`/api/mailboxes/${mailboxId}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch { /* server not running yet */ }
  }, [authedFetch]);

  useEffect(() => { loadMessages(selectedMailbox); }, [selectedMailbox, loadMessages]);

  async function createMailbox() {
    if (!localPart.trim()) { setCreateResult({ error: 'Enter a local part first.' }); return; }
    setCreating(true);
    setCreateResult({ loading: true });
    try {
      const res = await authedFetch('/api/mailboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localPart: localPart.trim(), forwardTo: forwardTo.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) { setCreateResult({ error: data.error }); return; }
      setCreateResult({ redirecting: true });
      redirectToPayfastCheckout(data.payfastUrl, data.checkoutFields);
    } catch (err) {
      setCreateResult({ error: err.message });
    } finally {
      setCreating(false);
    }
  }

  async function resetWebmailPassword(id) {
    if (!confirm("Reset this mailbox's webmail password? Anyone using the old password will be signed out.")) return;
    try {
      const res = await authedFetch(`/api/mailboxes/${id}/webmail-password/reset`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to reset password'); return; }
      setCreateResult({ success: data, isReset: true });
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteMailbox(id) {
    if (!confirm('Delete this mailbox? This cannot be undone.')) return;
    try {
      const res = await authedFetch(`/api/mailboxes/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete mailbox');
        return;
      }
      loadMailboxes();
    } catch (err) {
      alert(err.message);
    }
  }

  async function sendMessage() {
    if (!selectedMailbox) { setSendResult({ error: 'Select a mailbox first.' }); return; }
    if (!msgTo.trim() || !msgSubject.trim() || !msgBody.trim()) {
      setSendResult({ error: 'Fill in to, subject, and message.' });
      return;
    }
    setSending(true);
    setSendResult({ loading: true });
    try {
      const res = await authedFetch(`/api/mailboxes/${selectedMailbox}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: msgTo.trim(), subject: msgSubject.trim(), text: msgBody.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setSendResult({ error: data.error }); return; }
      setSendResult({ success: true });
      setMsgTo('');
      setMsgSubject('');
      setMsgBody('');
      loadMessages(selectedMailbox);
    } catch (err) {
      setSendResult({ error: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Mailboxes</h1>
      <p className="subtitle">Create an address; hand the customer the settings below to add it in Outlook.</p>

      <div className="panel-box">
        <h2>Create a mailbox</h2>
        <div className="form-row">
          <input value={localPart} onChange={(e) => setLocalPart(e.target.value)} placeholder="local part, e.g. sales" />
          <span style={{ alignSelf: 'center', color: 'var(--muted)' }}>@ your business domain</span>
        </div>
        <div className="form-row">
          <input value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} placeholder="forward/store to (optional)" style={{ flex: 1, minWidth: 220 }} />
          <button className="primary" disabled={creating} onClick={createMailbox}>Continue to payment</button>
        </div>
        <CreateResultView result={createResult} />
      </div>

      <div className="panel-box">
        <h2>Your mailboxes</h2>
        <table>
          <thead><tr><th>Address</th><th>SMTP host</th><th>Inbound</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {mailboxes.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>No mailboxes yet</td></tr>
            ) : mailboxes.map((m) => (
              <tr key={m.id}>
                <td className="mono">{m.address}</td>
                <td className="mono">{m.smtp.host}</td>
                <td>{m.inboundCaptureEnabled ? <span style={{ color: 'var(--mail)' }}>Captured</span> : <span style={{ color: 'var(--muted)' }}>Forward only</span>}</td>
                <td>{new Date(m.createdAt).toLocaleString()}</td>
                <td>
                  <button className="link-btn" onClick={() => resetWebmailPassword(m.id)}>Reset webmail password</button>{' '}
                  <button className="danger" onClick={() => deleteMailbox(m.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-box">
        <h2>Messages</h2>
        <div className="form-row">
          <select value={selectedMailbox} onChange={(e) => setSelectedMailbox(e.target.value)}>
            <option value="">Select a mailbox…</option>
            {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.address}</option>)}
          </select>
        </div>

        {selectedMailbox && (
          <div>
            <div className="form-row">
              <input value={msgTo} onChange={(e) => setMsgTo(e.target.value)} placeholder="to@example.com" style={{ flex: 1, minWidth: 180 }} />
              <input value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} placeholder="Subject" style={{ flex: 1, minWidth: 180 }} />
            </div>
            <div className="form-row">
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Message"
                rows={3}
                style={{ flex: 1, minWidth: 260, background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--text)', padding: '10px 12px', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }}
              />
            </div>
            <div className="form-row">
              <button className="primary" disabled={sending} onClick={sendMessage}>Send</button>
            </div>
            {sendResult?.loading && <p style={{ color: 'var(--muted)' }}>Sending…</p>}
            {sendResult?.error && <p style={{ color: 'var(--danger)' }}>{sendResult.error}</p>}
            {sendResult?.success && <p style={{ color: 'var(--mail)' }}>Sent.</p>}
          </div>
        )}

        <table>
          <thead><tr><th>Direction</th><th>From</th><th>To</th><th>Subject</th><th>When</th></tr></thead>
          <tbody>
            {!selectedMailbox ? (
              <tr className="empty-row"><td colSpan={5}>Select a mailbox above</td></tr>
            ) : messages.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>No messages yet</td></tr>
            ) : messages.map((m) => (
              <tr key={m.id}>
                <td>{m.direction === 'inbound' ? '↓ In' : '↑ Out'}</td>
                <td className="mono">{m.from}</td>
                <td className="mono">{m.to}</td>
                <td>{m.subject}</td>
                <td>{new Date(m.at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateResultView({ result }) {
  if (!result) return null;
  if (result.loading) return <p style={{ color: 'var(--muted)' }}>Creating…</p>;
  if (result.redirecting) return <p style={{ color: 'var(--muted)' }}>Redirecting to payment…</p>;
  if (result.error) return <p style={{ color: 'var(--danger)' }}>{result.error}</p>;
  if (result.success) {
    const data = result.success;
    return (
      <>
        <div className="credential">
          <div className="row"><span>Address</span><span className="value">{data.address}</span></div>
          {!result.isReset && (
            <>
              <div className="row"><span>SMTP host</span><span className="value">{data.smtp.host}</span></div>
              <div className="row"><span>Port</span><span className="value">{data.smtp.port} ({data.smtp.security})</span></div>
            </>
          )}
          <div className="row"><span>Webmail login</span><span className="value">{typeof window !== 'undefined' ? window.location.origin : ''}/webmail-login</span></div>
          <div className="row"><span>{result.isReset ? 'New webmail password' : 'Webmail password'}</span><span className="value">{data.webmailPassword}</span></div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>{data.webmailPasswordNote}</p>
      </>
    );
  }
  return null;
}
