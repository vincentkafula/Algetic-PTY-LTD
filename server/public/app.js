const API = ''; // same-origin; server serves this static site too

// ---- account bar ----
(function initAccountBar() {
  const user = getStoredUser();
  const el = document.getElementById('accountEmail');
  if (el) el.textContent = user ? (user.companyName ? `${user.email} (${user.companyName})` : user.email) : '…';
})();

// ---- view switching ----
document.querySelectorAll('.sidebar nav a[data-view]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar nav a[data-view]').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    const view = a.dataset.view;
    document.getElementById('view-mail').style.display = view === 'mail' ? 'block' : 'none';
    document.getElementById('view-voice').style.display = view === 'voice' ? 'block' : 'none';
    document.getElementById('view-sipnet').style.display = view === 'sipnet' ? 'block' : 'none';
  });
});

// ---- health check banner ----
async function checkHealth() {
  const el = document.getElementById('apiStatus');
  const sipEl = document.getElementById('sipnetStatus');
  try {
    const res = await fetch(`${API}/api/health`);
    const data = await res.json();
    if (data.mailgunConfigured && data.twilioConfigured) {
      el.className = 'status-banner ok';
      el.textContent = `Connected — supported number countries: ${data.supportedCountries.join(', ')}`;
    } else {
      el.className = 'status-banner warn';
      const missing = [];
      if (!data.mailgunConfigured) missing.push('Mailgun');
      if (!data.twilioConfigured) missing.push('Twilio');
      el.textContent = `Demo mode — add real ${missing.join(' and ')} credentials to server/.env to go live.`;
    }
    if (sipEl) {
      if (data.sipNetworkConfigured) {
        sipEl.className = 'status-banner ok';
        sipEl.textContent = 'Connected to your private SIP network.';
      } else {
        sipEl.className = 'status-banner warn';
        sipEl.textContent = 'Not configured — set SIP_NETWORK_API_URL and SIP_NETWORK_API_KEY in server/.env once you\'ve deployed sip-network/.';
      }
    }
  } catch (err) {
    el.className = 'status-banner warn';
    el.textContent = 'Could not reach the CommHub server. Is `npm start` running in /server?';
  }
}
checkHealth();

// ---- mailboxes ----
async function createMailbox() {
  const localPart = document.getElementById('mailLocalPart').value.trim();
  const forwardTo = document.getElementById('mailForwardTo').value.trim();
  const resultEl = document.getElementById('mailResult');
  if (!localPart) { resultEl.innerHTML = '<p style="color:var(--danger)">Enter a local part first.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Creating…</p>';
  try {
    const res = await authedFetch(`${API}/api/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localPart, forwardTo: forwardTo || undefined })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }

    resultEl.innerHTML = `
      <div class="credential">
        <div class="row"><span>Address</span><span class="value">${data.address}</span></div>
        <div class="row"><span>SMTP host</span><span class="value">${data.smtp.host}</span></div>
        <div class="row"><span>Port</span><span class="value">${data.smtp.port} (${data.smtp.security})</span></div>
      </div>`;
    document.getElementById('mailLocalPart').value = '';
    document.getElementById('mailForwardTo').value = '';
    loadMailboxes();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function deleteMailbox(id) {
  if (!confirm('Delete this mailbox? This cannot be undone.')) return;
  try {
    const res = await authedFetch(`${API}/api/mailboxes/${id}`, { method: 'DELETE' });
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

async function loadMailboxes() {
  const tbody = document.getElementById('mailTable');
  const select = document.getElementById('msgMailboxSelect');
  try {
    const res = await authedFetch(`${API}/api/mailboxes`);
    const data = await res.json();
    if (!data.mailboxes || data.mailboxes.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No mailboxes yet</td></tr>';
      select.innerHTML = '<option value="">Select a mailbox…</option>';
      return;
    }
    tbody.innerHTML = data.mailboxes.map(m => `
      <tr>
        <td class="mono">${m.address}</td>
        <td class="mono">${m.smtp.host}</td>
        <td>${m.inboundCaptureEnabled ? '<span style="color:var(--mail)">Captured</span>' : '<span style="color:var(--muted)">Forward only</span>'}</td>
        <td>${new Date(m.createdAt).toLocaleString()}</td>
        <td><button class="danger" onclick="deleteMailbox('${m.id}')">Delete</button></td>
      </tr>`).join('');

    const previousSelection = select.value;
    select.innerHTML = '<option value="">Select a mailbox…</option>' +
      data.mailboxes.map(m => `<option value="${m.id}">${m.address}</option>`).join('');
    if (previousSelection && data.mailboxes.some(m => m.id === previousSelection)) {
      select.value = previousSelection;
    }
  } catch (err) { /* server not running yet, leave empty state */ }
}

// ---- numbers ----
async function searchNumbers() {
  const country = document.getElementById('voiceCountry').value;
  const areaCode = document.getElementById('voiceAreaCode').value.trim();
  const resultEl = document.getElementById('voiceSearchResult');
  resultEl.innerHTML = '<p style="color:var(--muted)">Searching…</p>';

  try {
    const qs = new URLSearchParams({ country });
    if (areaCode) qs.set('areaCode', areaCode);
    const res = await authedFetch(`${API}/api/numbers/search?${qs}`);
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }

    if (!data.results || data.results.length === 0) {
      resultEl.innerHTML = '<p style="color:var(--muted)">No numbers found for that search.</p>';
      return;
    }
    resultEl.innerHTML = data.results.map(r => `
      <div class="credential">
        <div class="row"><span>${r.friendlyName}</span>
        <button class="primary voice" onclick="provisionNumber('${r.phoneNumber}')">Provision</button></div>
      </div>`).join('');
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function provisionNumber(phoneNumber) {
  const resultEl = document.getElementById('voiceSearchResult');
  try {
    const res = await authedFetch(`${API}/api/numbers/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML += `<p style="color:var(--danger)">${data.error}</p>`; return; }

    const s = data.sipSetup;
    resultEl.innerHTML = `
      <div class="credential">
        <div class="row"><span>Number</span><span class="value">${data.phoneNumber}</span></div>
        <div class="row"><span>SIP domain</span><span class="value">${s.domain}</span></div>
        <div class="row"><span>SIP username</span><span class="value">${s.username}</span></div>
        ${s.password ? `<div class="row"><span>SIP password</span><span class="value">${s.password}</span></div>` : ''}
      </div>
      <p style="color:var(--muted);font-size:12px;margin-top:8px">${s.passwordNote}</p>
      <p style="color:var(--muted);font-size:12px">${s.inboundNote}</p>`;
    loadNumbers();
    loadTrunk();
  } catch (err) {
    resultEl.innerHTML += `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function releaseNumber(id) {
  if (!confirm('Release this number? It will stop working immediately.')) return;
  try {
    const res = await authedFetch(`${API}/api/numbers/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to release number');
      return;
    }
    loadNumbers();
  } catch (err) {
    alert(err.message);
  }
}

async function loadNumbers() {
  const tbody = document.getElementById('voiceTable');
  try {
    const res = await authedFetch(`${API}/api/numbers`);
    const data = await res.json();
    if (!data.provisioned || data.provisioned.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No numbers yet</td></tr>';
      return;
    }
    tbody.innerHTML = data.provisioned.map(n => `
      <tr>
        <td class="mono">${n.phoneNumber}</td>
        <td>${n.customerLabel || '—'}</td>
        <td class="mono">${n.sipSetup.username}</td>
        <td>${new Date(n.provisionedAt).toLocaleString()}</td>
        <td><button class="danger" onclick="releaseNumber('${n.id}')">Release</button></td>
      </tr>`).join('');
  } catch (err) { /* server not running yet, leave empty state */ }
}

// ---- messages ----
async function loadMessages() {
  const mailboxId = document.getElementById('msgMailboxSelect').value;
  const tbody = document.getElementById('msgTable');
  const composeForm = document.getElementById('composeForm');

  if (!mailboxId) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Select a mailbox above</td></tr>';
    composeForm.style.display = 'none';
    return;
  }
  composeForm.style.display = 'block';

  try {
    const res = await authedFetch(`${API}/api/mailboxes/${mailboxId}/messages`);
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No messages yet</td></tr>';
      return;
    }
    tbody.innerHTML = data.messages.map(m => `
      <tr>
        <td>${m.direction === 'inbound' ? '↓ In' : '↑ Out'}</td>
        <td class="mono">${m.from}</td>
        <td class="mono">${m.to}</td>
        <td>${m.subject}</td>
        <td>${new Date(m.at).toLocaleString()}</td>
      </tr>`).join('');
  } catch (err) { /* server not running yet, leave empty state */ }
}

async function sendMessage() {
  const mailboxId = document.getElementById('msgMailboxSelect').value;
  const to = document.getElementById('msgTo').value.trim();
  const subject = document.getElementById('msgSubject').value.trim();
  const text = document.getElementById('msgBody').value.trim();
  const resultEl = document.getElementById('msgSendResult');

  if (!mailboxId) { resultEl.innerHTML = '<p style="color:var(--danger)">Select a mailbox first.</p>'; return; }
  if (!to || !subject || !text) { resultEl.innerHTML = '<p style="color:var(--danger)">Fill in to, subject, and message.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Sending…</p>';
  try {
    const res = await authedFetch(`${API}/api/mailboxes/${mailboxId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = '<p style="color:var(--mail)">Sent.</p>';
    document.getElementById('msgTo').value = '';
    document.getElementById('msgSubject').value = '';
    document.getElementById('msgBody').value = '';
    loadMessages();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

loadMailboxes();
loadNumbers();
loadTrunk();

// ---- SIP trunk ----
async function loadTrunk() {
  const el = document.getElementById('trunkInfo');
  try {
    const res = await authedFetch(`${API}/api/numbers/trunk`);
    if (res.status === 404) {
      el.innerHTML = '<p style="color:var(--muted)">No trunk yet — provision a number first.</p>';
      return;
    }
    const data = await res.json();
    if (!res.ok) { el.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    const t = data.trunk;
    el.innerHTML = `
      <div class="credential">
        <div class="row"><span>SIP domain</span><span class="value">${t.domainName}</span></div>
        <div class="row"><span>SIP username</span><span class="value">${t.sipUsername}</span></div>
        <div class="row"><span>Origination address</span><span class="value">${t.originationUri || 'not set'}</span></div>
      </div>`;
  } catch (err) { /* server not running yet, leave empty state */ }
}

async function setTrunkOrigination() {
  const sipUri = document.getElementById('trunkOriginationUri').value.trim();
  const resultEl = document.getElementById('trunkResult');
  if (!sipUri) { resultEl.innerHTML = '<p style="color:var(--danger)">Enter a SIP URI first.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Setting…</p>';
  try {
    const res = await authedFetch(`${API}/api/numbers/trunk/origination`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sipUri })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = '<p style="color:var(--mail)">Origination address updated.</p>';
    document.getElementById('trunkOriginationUri').value = '';
    loadTrunk();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function resetTrunkPassword() {
  if (!confirm('Reset the SIP password? Any device using the current password will stop working until updated.')) return;
  const resultEl = document.getElementById('trunkResult');
  try {
    const res = await authedFetch(`${API}/api/numbers/trunk/reset-password`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = `
      <div class="credential">
        <div class="row"><span>New SIP username</span><span class="value">${data.trunk.sipUsername}</span></div>
        <div class="row"><span>New SIP password</span><span class="value">${data.password}</span></div>
      </div>
      <p style="color:var(--muted);font-size:12px;margin-top:8px">Save this now — it will not be shown again.</p>`;
    loadTrunk();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

// ---- private SIP network ----
async function loadSipUsers() {
  const tbody = document.getElementById('sipnetTable');
  if (!tbody) return;
  try {
    const res = await authedFetch(`${API}/api/sip-network/users`);
    const data = await res.json();
    if (!res.ok) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="3">${data.error}</td></tr>`;
      return;
    }
    if (!data.subscribers || data.subscribers.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No subscribers yet</td></tr>';
      return;
    }
    tbody.innerHTML = data.subscribers.map(u => `
      <tr>
        <td class="mono">${u}</td>
        <td class="mono">${u}@${data.domain}</td>
        <td><button class="danger" onclick="removeSipUser('${u}')">Remove</button></td>
      </tr>`).join('');
  } catch (err) { /* server not running yet, leave empty state */ }
}

async function addSipUser() {
  const username = document.getElementById('sipnetUsername').value.trim();
  const password = document.getElementById('sipnetPassword').value;
  const resultEl = document.getElementById('sipnetResult');
  if (!username || !password) { resultEl.innerHTML = '<p style="color:var(--danger)">Enter a username and password.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Saving…</p>';
  try {
    const res = await authedFetch(`${API}/api/sip-network/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = `<p style="color:var(--mail)">${data.created ? 'Added' : 'Updated'} ${data.username}@${data.domain}.</p>`;
    document.getElementById('sipnetUsername').value = '';
    document.getElementById('sipnetPassword').value = '';
    loadSipUsers();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function removeSipUser(username) {
  if (!confirm(`Remove ${username}? Their phone will stop working immediately.`)) return;
  try {
    const res = await authedFetch(`${API}/api/sip-network/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to remove subscriber');
      return;
    }
    loadSipUsers();
  } catch (err) {
    alert(err.message);
  }
}

loadSipUsers();
