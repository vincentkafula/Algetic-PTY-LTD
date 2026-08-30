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
    document.getElementById('view-callcentre').style.display = view === 'callcentre' ? 'block' : 'none';
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
    const ccEl = document.getElementById('ccStatus');
    if (ccEl) {
      if (data.callCentreConfigured) {
        ccEl.className = 'status-banner ok';
        ccEl.textContent = 'Connected — Twilio and PUBLIC_BASE_URL are configured.';
      } else {
        ccEl.className = 'status-banner warn';
        ccEl.textContent = 'Not configured — set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / PUBLIC_BASE_URL in server/.env.';
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

// ---- call centre ----
function parseMenuOptions(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [digit, action, ...rest] = line.split(':');
    return { digit: (digit || '').trim(), action: (action || '').trim(), target: rest.join(':').trim() };
  });
}

async function createMenu() {
  const name = document.getElementById('ccMenuName').value.trim();
  const greeting = document.getElementById('ccMenuGreeting').value.trim();
  const optionsText = document.getElementById('ccMenuOptions').value;
  const resultEl = document.getElementById('ccMenuResult');
  if (!name || !greeting) { resultEl.innerHTML = '<p style="color:var(--danger)">Name and greeting are required.</p>'; return; }
  const options = parseMenuOptions(optionsText);
  if (options.length === 0) { resultEl.innerHTML = '<p style="color:var(--danger)">Add at least one option line.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Saving…</p>';
  try {
    const res = await authedFetch(`${API}/api/call-centre/menus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, greeting, options })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = `<p style="color:var(--mail)">Created "${data.name}". Its id is <span class="mono">${data.id}</span> — use that as a target for "menu" or "queue" options.</p>`;
    document.getElementById('ccMenuName').value = '';
    document.getElementById('ccMenuGreeting').value = '';
    document.getElementById('ccMenuOptions').value = '';
    loadMenus();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function deleteMenu(id) {
  if (!confirm('Delete this menu?')) return;
  try {
    const res = await authedFetch(`${API}/api/call-centre/menus/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete menu');
      return;
    }
    loadMenus();
  } catch (err) { alert(err.message); }
}

async function loadMenus() {
  const tbody = document.getElementById('ccMenuTable');
  const menuSelect = document.getElementById('ccNumberMenu');
  try {
    const res = await authedFetch(`${API}/api/call-centre/menus`);
    const data = await res.json();
    if (!data.menus || data.menus.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No menus yet</td></tr>';
      if (menuSelect) menuSelect.innerHTML = '<option value="">Select a menu…</option>';
      return;
    }
    tbody.innerHTML = data.menus.map(m => `
      <tr>
        <td>${m.name}</td>
        <td>${m.greeting}</td>
        <td class="mono">${(m.options || []).map(o => `${o.digit}→${o.action}`).join(', ')}</td>
        <td><button class="danger" onclick="deleteMenu('${m.id}')">Delete</button></td>
      </tr>`).join('');
    if (menuSelect) {
      menuSelect.innerHTML = '<option value="">Select a menu…</option>' +
        data.menus.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
  } catch (err) { /* server not running yet */ }
}

async function createQueue() {
  const name = document.getElementById('ccQueueName').value.trim();
  const resultEl = document.getElementById('ccQueueResult');
  if (!name) { resultEl.innerHTML = '<p style="color:var(--danger)">Enter a queue name.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Creating…</p>';
  try {
    const res = await authedFetch(`${API}/api/call-centre/queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = `<p style="color:var(--mail)">Created "${data.name}". Its id is <span class="mono">${data.id}</span> — use that as the target of a "queue" menu option.</p>`;
    document.getElementById('ccQueueName').value = '';
    loadQueues();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function deleteQueue(id) {
  if (!confirm('Delete this queue?')) return;
  try {
    const res = await authedFetch(`${API}/api/call-centre/queues/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete queue');
      return;
    }
    loadQueues();
  } catch (err) { alert(err.message); }
}

async function loadQueues() {
  const tbody = document.getElementById('ccQueueTable');
  const queueSelect = document.getElementById('ccAgentQueue');
  try {
    const res = await authedFetch(`${API}/api/call-centre/queues`);
    const data = await res.json();
    if (!data.queues || data.queues.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No queues yet</td></tr>';
      if (queueSelect) queueSelect.innerHTML = '<option value="">Select a queue…</option>';
      return;
    }
    const rows = await Promise.all(data.queues.map(async q => {
      let waiting = '—';
      try {
        const statusRes = await authedFetch(`${API}/api/call-centre/queues/${q.id}/status`);
        const statusData = await statusRes.json();
        if (statusRes.ok) waiting = statusData.currentSize;
      } catch (e) { /* leave as — if Twilio isn't configured */ }
      return `<tr><td>${q.name}</td><td>${waiting}</td><td><button class="danger" onclick="deleteQueue('${q.id}')">Delete</button></td></tr>`;
    }));
    tbody.innerHTML = rows.join('');
    if (queueSelect) {
      queueSelect.innerHTML = '<option value="">Select a queue…</option>' +
        data.queues.map(q => `<option value="${q.id}">${q.name}</option>`).join('');
    }
  } catch (err) { /* server not running yet */ }
}

async function createAgent() {
  const name = document.getElementById('ccAgentName').value.trim();
  const phoneNumber = document.getElementById('ccAgentPhone').value.trim();
  const queueId = document.getElementById('ccAgentQueue').value;
  const resultEl = document.getElementById('ccAgentResult');
  if (!name || !phoneNumber || !queueId) { resultEl.innerHTML = '<p style="color:var(--danger)">Name, phone, and queue are all required.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Adding…</p>';
  try {
    const res = await authedFetch(`${API}/api/call-centre/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phoneNumber, queueId })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = `<p style="color:var(--mail)">Added ${data.name}.</p>`;
    document.getElementById('ccAgentName').value = '';
    document.getElementById('ccAgentPhone').value = '';
    loadAgents();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function toggleAgentAvailability(id, available) {
  try {
    const res = await authedFetch(`${API}/api/call-centre/agents/${id}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to update availability');
    }
    loadAgents();
  } catch (err) { alert(err.message); }
}

async function deleteAgent(id) {
  if (!confirm('Remove this agent?')) return;
  try {
    const res = await authedFetch(`${API}/api/call-centre/agents/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to remove agent');
      return;
    }
    loadAgents();
  } catch (err) { alert(err.message); }
}

async function loadAgents() {
  const tbody = document.getElementById('ccAgentTable');
  try {
    const [agentsRes, queuesRes] = await Promise.all([
      authedFetch(`${API}/api/call-centre/agents`),
      authedFetch(`${API}/api/call-centre/queues`)
    ]);
    const agentsData = await agentsRes.json();
    const queuesData = await queuesRes.json();
    const queueNames = {};
    (queuesData.queues || []).forEach(q => { queueNames[q.id] = q.name; });

    if (!agentsData.agents || agentsData.agents.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No agents yet</td></tr>';
      return;
    }
    tbody.innerHTML = agentsData.agents.map(a => `
      <tr>
        <td>${a.name}</td>
        <td class="mono">${a.phoneNumber}</td>
        <td>${queueNames[a.queueId] || '—'}</td>
        <td><input type="checkbox" ${a.available ? 'checked' : ''} onchange="toggleAgentAvailability('${a.id}', this.checked)" /></td>
        <td><button class="danger" onclick="deleteAgent('${a.id}')">Remove</button></td>
      </tr>`).join('');
  } catch (err) { /* server not running yet */ }
}

async function assignNumberToMenu() {
  const numberId = document.getElementById('ccNumberSelect').value;
  const menuId = document.getElementById('ccNumberMenu').value;
  const resultEl = document.getElementById('ccAssignResult');
  if (!numberId || !menuId) { resultEl.innerHTML = '<p style="color:var(--danger)">Select both a number and a menu.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Assigning…</p>';
  try {
    const res = await authedFetch(`${API}/api/call-centre/numbers/${numberId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuId })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = '<p style="color:var(--mail)">Assigned.</p>';
    loadCallCentreNumbers();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function unassignNumber(numberId) {
  if (!confirm('Unassign this number from the call centre? It will stop handling calls until reassigned.')) return;
  try {
    const res = await authedFetch(`${API}/api/call-centre/numbers/${numberId}/unassign`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to unassign');
      return;
    }
    loadCallCentreNumbers();
  } catch (err) { alert(err.message); }
}

async function loadCallCentreNumbers() {
  const tbody = document.getElementById('ccNumberTable');
  const numberSelect = document.getElementById('ccNumberSelect');
  try {
    const [numbersRes, menusRes] = await Promise.all([
      authedFetch(`${API}/api/numbers`),
      authedFetch(`${API}/api/call-centre/menus`)
    ]);
    const numbersData = await numbersRes.json();
    const menusData = await menusRes.json();
    const menuNames = {};
    (menusData.menus || []).forEach(m => { menuNames[m.id] = m.name; });

    if (!numbersData.provisioned || numbersData.provisioned.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No numbers yet — provision one under Phone numbers first</td></tr>';
      if (numberSelect) numberSelect.innerHTML = '<option value="">Select a number…</option>';
      return;
    }
    tbody.innerHTML = numbersData.provisioned.map(n => `
      <tr>
        <td class="mono">${n.phoneNumber}</td>
        <td>${n.callCentreMenuId ? (menuNames[n.callCentreMenuId] || 'Unknown menu') : '—'}</td>
        <td>${n.callCentreMenuId ? `<button class="danger" onclick="unassignNumber('${n.id}')">Unassign</button>` : ''}</td>
      </tr>`).join('');
    if (numberSelect) {
      numberSelect.innerHTML = '<option value="">Select a number…</option>' +
        numbersData.provisioned.map(n => `<option value="${n.id}">${n.phoneNumber}</option>`).join('');
    }
  } catch (err) { /* server not running yet */ }
}

loadMenus();
loadQueues();
loadAgents();
loadCallCentreNumbers();
