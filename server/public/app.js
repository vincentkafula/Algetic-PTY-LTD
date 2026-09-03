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
    document.getElementById('view-domains').style.display = view === 'domains' ? 'block' : 'none';
    document.getElementById('view-projects').style.display = view === 'projects' ? 'block' : 'none';
    document.getElementById('view-mvno').style.display = view === 'mvno' ? 'block' : 'none';
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
    const domainsEl = document.getElementById('domainsStatus');
    if (domainsEl) {
      if (data.domainsConfigured) {
        domainsEl.className = 'status-banner ok';
        domainsEl.textContent = 'Connected to GoDaddy.';
      } else {
        domainsEl.className = 'status-banner warn';
        domainsEl.textContent = 'Not configured — set GODADDY_PAT in server/.env.';
      }
    }
  } catch (err) {
    el.className = 'status-banner warn';
    el.textContent = 'Could not reach the Altegic server. Is `npm start` running in /server?';
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
        <div class="row"><span>Webmail login</span><span class="value">${window.location.origin}/webmail-login.html</span></div>
        <div class="row"><span>Webmail password</span><span class="value">${data.webmailPassword}</span></div>
      </div>
      <p style="color:var(--muted);font-size:12px;margin-top:8px">${data.webmailPasswordNote}</p>`;
    document.getElementById('mailLocalPart').value = '';
    document.getElementById('mailForwardTo').value = '';
    loadMailboxes();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function resetWebmailPassword(id) {
  if (!confirm('Reset this mailbox\'s webmail password? Anyone using the old password will be signed out.')) return;
  try {
    const res = await authedFetch(`${API}/api/mailboxes/${id}/webmail-password/reset`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to reset password'); return; }
    const resultEl = document.getElementById('mailResult');
    resultEl.innerHTML = `
      <div class="credential">
        <div class="row"><span>Address</span><span class="value">${data.address}</span></div>
        <div class="row"><span>Webmail login</span><span class="value">${window.location.origin}/webmail-login.html</span></div>
        <div class="row"><span>New webmail password</span><span class="value">${data.webmailPassword}</span></div>
      </div>
      <p style="color:var(--muted);font-size:12px;margin-top:8px">${data.webmailPasswordNote}</p>`;
  } catch (err) {
    alert(err.message);
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
        <td><button class="link-btn" onclick="resetWebmailPassword('${m.id}')">Reset webmail password</button> <button class="danger" onclick="deleteMailbox('${m.id}')">Delete</button></td>
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

// ---- domains ----
async function searchDomain() {
  const domain = document.getElementById('domainSearchInput').value.trim();
  const resultEl = document.getElementById('domainSearchResult');
  if (!domain) { resultEl.innerHTML = '<p style="color:var(--danger)">Enter a domain name.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Checking…</p>';
  try {
    const res = await authedFetch(`${API}/api/domains/search?domain=${encodeURIComponent(domain)}`);
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }

    if (!data.available) {
      resultEl.innerHTML = `<p style="color:var(--danger)">${domain} is not available.</p>`;
      return;
    }
    const price = data.prices && data.prices[0] ? `$${(data.prices[0].price.value / 100).toFixed(2)}/${data.prices[0].period}yr` : '';
    resultEl.innerHTML = `
      <div class="credential">
        <div class="row"><span>${domain}</span><span class="value">Available ${price}</span></div>
      </div>
      <button class="primary" style="margin-top:10px" onclick="getDomainQuote('${domain}')">Get a price quote</button>
      <div id="domainQuoteResult"></div>`;
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function getDomainQuote(domain) {
  const resultEl = document.getElementById('domainQuoteResult');
  resultEl.innerHTML = '<p style="color:var(--muted)">Getting quote…</p>';
  try {
    const res = await authedFetch(`${API}/api/domains/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, period: 1 })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }

    const agreements = data.requiredAgreements || [];
    const checkboxes = agreements.map((a, i) => `
      <label style="display:block;font-size:13px;color:var(--muted);margin:6px 0">
        <input type="checkbox" class="domain-agreement-cb" data-type="${a.agreementType}" />
        I agree to ${a.title ? a.title : a.agreementType}${a.url ? ` (<a href="${a.url}" target="_blank" rel="noopener" style="color:var(--mail)">read</a>)` : ''}
      </label>`).join('');

    resultEl.innerHTML = `
      <div class="credential" style="margin-top:10px">
        <div class="row"><span>Locked price</span><span class="value">$${(data.price.value / 100).toFixed(2)}</span></div>
        <div class="row"><span>Renewal price</span><span class="value">$${(data.renewalPrice.value / 100).toFixed(2)}/yr</span></div>
        <div class="row"><span>Quote expires</span><span class="value">${new Date(data.expiresAt).toLocaleTimeString()}</span></div>
      </div>
      ${checkboxes}
      <button class="danger" style="margin-top:10px" onclick='confirmDomainRegister(${JSON.stringify(domain)}, ${JSON.stringify(data.quoteToken)})'>Register this domain now</button>
      <p class="hint" style="color:var(--muted);font-size:12px;margin-top:6px">This charges your connected GoDaddy account and cannot be undone.</p>`;
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function confirmDomainRegister(domain, quoteToken) {
  const checkboxes = Array.from(document.querySelectorAll('.domain-agreement-cb'));
  const unchecked = checkboxes.filter(cb => !cb.checked);
  if (unchecked.length > 0) {
    alert('Please agree to every listed agreement before registering.');
    return;
  }
  if (!confirm(`Register ${domain} now? This charges your GoDaddy account and cannot be undone.`)) return;

  const agreedAgreementTypes = checkboxes.map(cb => cb.dataset.type);
  const resultEl = document.getElementById('domainQuoteResult');
  resultEl.innerHTML = '<p style="color:var(--muted)">Registering…</p>';
  try {
    const res = await authedFetch(`${API}/api/domains/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, quoteToken, period: 1, agreedAgreementTypes })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = `<p style="color:var(--mail)">Registration submitted — status: ${data.status}.</p>`;
    loadDomains();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function refreshDomainStatus(id) {
  try {
    await authedFetch(`${API}/api/domains/${id}/status`);
    loadDomains();
  } catch (err) { alert(err.message); }
}

async function loadDomains() {
  const tbody = document.getElementById('domainsTable');
  const dnsSelect = document.getElementById('dnsDomainSelect');
  if (!tbody) return;
  try {
    const res = await authedFetch(`${API}/api/domains`);
    const data = await res.json();
    if (!data.domains || data.domains.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No domains yet</td></tr>';
      if (dnsSelect) dnsSelect.innerHTML = '<option value="">Select a domain…</option>';
      return;
    }
    tbody.innerHTML = data.domains.map(d => `
      <tr>
        <td class="mono">${d.domain}</td>
        <td>${d.status}</td>
        <td><button class="link-btn" onclick="refreshDomainStatus('${d.id}')">Refresh status</button></td>
      </tr>`).join('');
    if (dnsSelect) {
      const previousSelection = dnsSelect.value;
      dnsSelect.innerHTML = '<option value="">Select a domain…</option>' +
        data.domains.map(d => `<option value="${d.id}">${d.domain}</option>`).join('');
      if (previousSelection && data.domains.some(d => d.id === previousSelection)) {
        dnsSelect.value = previousSelection;
      }
    }
  } catch (err) { /* server not running yet */ }
}

// ---- DNS records ----
async function loadDnsRecords() {
  const domainId = document.getElementById('dnsDomainSelect').value;
  const tbody = document.getElementById('dnsTable');
  const addForm = document.getElementById('dnsAddForm');

  if (!domainId) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Select a domain above</td></tr>';
    addForm.style.display = 'none';
    return;
  }
  addForm.style.display = 'block';

  try {
    const res = await authedFetch(`${API}/api/domains/${domainId}/dns`);
    const data = await res.json();
    if (!res.ok) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${data.error}</td></tr>`;
      return;
    }
    const records = Array.isArray(data) ? data : (data.records || []);
    if (records.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No DNS records yet</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(r => `
      <tr>
        <td>${r.type}</td>
        <td class="mono">${r.name}</td>
        <td class="mono">${r.data}</td>
        <td>${r.ttl}</td>
        <td><button class="danger" onclick="deleteDnsRecord('${domainId}', '${r.type}', '${r.name}')">Delete</button></td>
      </tr>`).join('');
  } catch (err) { /* server not running yet */ }
}

async function addDnsRecord() {
  const domainId = document.getElementById('dnsDomainSelect').value;
  const type = document.getElementById('dnsRecordType').value;
  const name = document.getElementById('dnsRecordName').value.trim();
  const data = document.getElementById('dnsRecordData').value.trim();
  const ttl = document.getElementById('dnsRecordTtl').value.trim();
  const resultEl = document.getElementById('dnsResult');
  if (!domainId) { resultEl.innerHTML = '<p style="color:var(--danger)">Select a domain first.</p>'; return; }
  if (!name || !data) { resultEl.innerHTML = '<p style="color:var(--danger)">Name and value are required.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Adding…</p>';
  try {
    const res = await authedFetch(`${API}/api/domains/${domainId}/dns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, data, ttl: ttl ? parseInt(ttl, 10) : undefined })
    });
    const responseData = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${responseData.error}</p>`; return; }
    resultEl.innerHTML = '<p style="color:var(--mail)">Record added.</p>';
    document.getElementById('dnsRecordName').value = '';
    document.getElementById('dnsRecordData').value = '';
    document.getElementById('dnsRecordTtl').value = '';
    loadDnsRecords();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function deleteDnsRecord(domainId, type, name) {
  if (!confirm(`Delete all ${type} records for "${name}"?`)) return;
  try {
    const res = await authedFetch(`${API}/api/domains/${domainId}/dns/${type}/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete record');
      return;
    }
    loadDnsRecords();
  } catch (err) { alert(err.message); }
}

// ---- website, software & internet projects ----
function updateProjectFormHints() {
  const type = document.getElementById('projectType').value;
  const descEl = document.getElementById('projectDescription');
  if (!descEl) return;
  const hints = {
    website: 'Describe what you need — pages, purpose, examples you like',
    software: 'Describe what you need — the problem it solves, who uses it',
    internet: 'Describe what you need — installation address, preferred provider (e.g. Rain), current connection if any'
  };
  descEl.placeholder = hints[type] || 'Describe what you need';
}

async function createProject() {
  const type = document.getElementById('projectType').value;
  const title = document.getElementById('projectTitle').value.trim();
  const description = document.getElementById('projectDescription').value.trim();
  const budget = document.getElementById('projectBudget').value.trim();
  const resultEl = document.getElementById('projectResult');
  if (!title || !description) { resultEl.innerHTML = '<p style="color:var(--danger)">Title and description are required.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Submitting…</p>';
  try {
    const res = await authedFetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, description, budget: budget || undefined })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = '<p style="color:var(--mail)">Request submitted.</p>';
    document.getElementById('projectTitle').value = '';
    document.getElementById('projectDescription').value = '';
    document.getElementById('projectBudget').value = '';
    loadProjects();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function updateProjectStatus(id, status) {
  try {
    const res = await authedFetch(`${API}/api/projects/${id}/status`, {
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
    const res = await authedFetch(`${API}/api/projects/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete');
      return;
    }
    loadProjects();
  } catch (err) { alert(err.message); }
}

async function loadProjects() {
  const tbody = document.getElementById('projectsTable');
  if (!tbody) return;
  try {
    const res = await authedFetch(`${API}/api/projects`);
    const data = await res.json();
    if (!data.projects || data.projects.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No requests yet</td></tr>';
      return;
    }
    const statuses = ['Requested', 'In Progress', 'Delivered', 'Cancelled'];
    tbody.innerHTML = data.projects.map(p => `
      <tr>
        <td>${p.title}</td>
        <td>${p.type}</td>
        <td>${p.budget || '—'}</td>
        <td>
          <select onchange="updateProjectStatus('${p.id}', this.value)">
            ${statuses.map(s => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td><button class="danger" onclick="deleteProject('${p.id}')">Delete</button></td>
      </tr>`).join('');
  } catch (err) { /* server not running yet */ }
}

loadDomains();
loadProjects();
updateProjectFormHints();

// ---- MVNO demo dashboard ----
function fmtNum(n) {
  return typeof n === 'number' ? n.toLocaleString() : n;
}

async function loadMvnoKpis() {
  const grid = document.getElementById('mvnoKpiGrid');
  if (!grid) return;
  try {
    const res = await authedFetch(`${API}/api/mvno/kpis`);
    const { data } = await res.json();
    const cells = [
      ['Total subscribers', fmtNum(data.totalSubscribers)],
      ['Active subscribers', fmtNum(data.activeSubscribers)],
      ['Network uptime', data.networkUptimePct + '%'],
      ['Active data sessions', fmtNum(data.activeDataSessions)],
      ['Active voice calls', fmtNum(data.activeVoiceCalls)],
      ['Revenue today (ZAR)', 'R' + fmtNum(data.revenueTodayZAR)],
      ['Fraud alerts active', data.fraudAlertsActive],
      ['Towers online', `${data.towersOnline} / ${data.totalTowerCount}`],
    ];
    grid.innerHTML = cells.map(([lbl, num]) => `<div class="cell"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');
  } catch (err) { /* server not running yet */ }
}

async function loadMvnoTowers() {
  const tbody = document.getElementById('mvnoTowersTable');
  if (!tbody) return;
  try {
    const res = await authedFetch(`${API}/api/mvno/towers`);
    const { data } = await res.json();
    tbody.innerHTML = data.map(t => `
      <tr>
        <td class="mono">${t.name}</td>
        <td>${t.region}</td>
        <td>${t.technology}</td>
        <td><span class="status-pill ${t.status}">${t.status}</span></td>
        <td>${t.loadPercent}%</td>
        <td>${fmtNum(t.connectedSubscribers)}</td>
      </tr>`).join('');
  } catch (err) { /* server not running yet */ }
}

async function loadMvnoSubscribers() {
  const tbody = document.getElementById('mvnoSubsTable');
  if (!tbody) return;
  try {
    const res = await authedFetch(`${API}/api/mvno/subscribers`);
    const { data } = await res.json();
    tbody.innerHTML = data.map(s => `
      <tr>
        <td class="mono">${s.msisdn}</td>
        <td><span class="status-pill ${s.status}">${s.status}</span></td>
        <td>${s.plan}</td>
        <td>${fmtNum(s.dataBalanceMB)} MB</td>
        <td>${s.roaming ? 'Yes' : '—'}</td>
      </tr>`).join('');
  } catch (err) { /* server not running yet */ }
}

async function loadMvnoFraud() {
  const tbody = document.getElementById('mvnoFraudTable');
  if (!tbody) return;
  try {
    const res = await authedFetch(`${API}/api/mvno/fraud-alerts`);
    const { data } = await res.json();
    tbody.innerHTML = data.map(f => `
      <tr>
        <td class="mono">${f.id}</td>
        <td>${f.type.replace('_', ' ')}</td>
        <td><span class="status-pill ${f.severity}">${f.severity}</span></td>
        <td class="mono">${f.msisdn}</td>
        <td>${f.riskScore}/10</td>
        <td>${new Date(f.detectedAt).toLocaleString()}</td>
      </tr>`).join('');
  } catch (err) { /* server not running yet */ }
}

async function loadMvnoBilling() {
  const el = document.getElementById('mvnoBillingResult');
  if (!el) return;
  try {
    const res = await authedFetch(`${API}/api/mvno/billing-summary`);
    const { data } = await res.json();
    el.innerHTML = `
      <div class="credential">
        <div class="row"><span>Revenue today</span><span class="value">R${fmtNum(data.revenueTodayZAR)}</span></div>
        <div class="row"><span>Revenue month-to-date</span><span class="value">R${fmtNum(data.revenueMTDZAR)}</span></div>
        <div class="row"><span>Invoices overdue</span><span class="value">${fmtNum(data.invoicesOverdue)}</span></div>
        <div class="row"><span>Invoices paid</span><span class="value">${fmtNum(data.invoicesPaid)}</span></div>
        <div class="row"><span>Avg revenue per user</span><span class="value">R${data.avgRevenuePerUserZAR}</span></div>
      </div>`;
  } catch (err) { /* server not running yet */ }
}

async function loadMvnoSupport() {
  const el = document.getElementById('mvnoSupportResult');
  if (!el) return;
  try {
    const res = await authedFetch(`${API}/api/mvno/support-summary`);
    const { data } = await res.json();
    const cats = Object.entries(data.categories).map(([k, v]) => `${k}: ${v}`).join(' · ');
    el.innerHTML = `
      <div class="credential">
        <div class="row"><span>Open tickets</span><span class="value">${fmtNum(data.openTickets)}</span></div>
        <div class="row"><span>Avg resolution time</span><span class="value">${data.avgResolutionHours}h</span></div>
        <div class="row"><span>CSAT score</span><span class="value">${data.csatScore}/5</span></div>
      </div>
      <p style="color:var(--muted);font-size:12px;margin-top:8px">${cats}</p>`;
  } catch (err) { /* server not running yet */ }
}

async function loadMvnoRoaming() {
  const tbody = document.getElementById('mvnoRoamingTable');
  if (!tbody) return;
  try {
    const res = await authedFetch(`${API}/api/mvno/roaming`);
    const { data } = await res.json();
    tbody.innerHTML = data.map(p => `
      <tr>
        <td>${p.networkName}</td>
        <td>${p.country}</td>
        <td><span class="status-pill ${p.status}">${p.status}</span></td>
        <td>${fmtNum(p.activeRoamers)}</td>
        <td>$${fmtNum(p.revenue30dUSD)}</td>
      </tr>`).join('');
  } catch (err) { /* server not running yet */ }
}

function loadMvnoAll() {
  loadMvnoKpis();
  loadMvnoTowers();
  loadMvnoSubscribers();
  loadMvnoFraud();
  loadMvnoBilling();
  loadMvnoSupport();
  loadMvnoRoaming();
}
loadMvnoAll();
