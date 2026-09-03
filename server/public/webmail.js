// Session management for the mailbox-level webmail login — deliberately
// SEPARATE from auth.js (which manages the Altegic account session). A
// mailbox owner and an Altegic account holder are not the same login,
// even when they happen to be the same person.
const WM_TOKEN_KEY = 'altegic_webmail_token';
const WM_ADDRESS_KEY = 'altegic_webmail_address';

function wmGetToken() {
  return localStorage.getItem(WM_TOKEN_KEY);
}
function wmSetSession(token, address) {
  localStorage.setItem(WM_TOKEN_KEY, token);
  localStorage.setItem(WM_ADDRESS_KEY, address);
}
function wmClearSession() {
  localStorage.removeItem(WM_TOKEN_KEY);
  localStorage.removeItem(WM_ADDRESS_KEY);
}
async function wmAuthedFetch(url, options = {}) {
  const token = wmGetToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    wmClearSession();
    window.location.href = 'webmail-login.html';
    throw new Error('Session expired');
  }
  return res;
}
function wmRequireSession() {
  if (!wmGetToken()) window.location.href = 'webmail-login.html';
}
function wmLogout() {
  wmClearSession();
  window.location.href = 'webmail-login.html';
}

// ---- login page ----
if (document.getElementById('wmLoginForm')) {
  if (wmGetToken()) window.location.href = 'webmail.html';
}

function toggleWmPassword() {
  const input = document.getElementById('wmPassword');
  const icon = document.getElementById('wmEyeIcon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = '<path d="M17.94 17.94A10.94 10.94 0 0112 20C5 20 1 12 1 12a19 19 0 015.06-6.06M9.9 4.24A10 10 0 0112 4c7 0 11 8 11 8a19 19 0 01-3.22 4.36M1 1l22 22"/>';
  } else {
    input.type = 'password';
    icon.innerHTML = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>';
  }
}

async function handleWebmailLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('wmError');
  errEl.textContent = '';
  const email = document.getElementById('wmEmail').value.trim();
  const password = document.getElementById('wmPassword').value;
  try {
    const res = await fetch('/api/webmail/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Sign in failed'; return false; }
    wmSetSession(data.token, data.address);
    window.location.href = 'webmail.html';
  } catch (err) {
    errEl.textContent = err.message;
  }
  return false;
}

// ---- inbox page ----
let wmCurrentFolder = 'inbox';
let wmCurrentMessages = [];
let wmOpenMessageId = null;

if (document.getElementById('wmMessageList')) {
  wmRequireSession();
  document.getElementById('wmAddress').textContent = localStorage.getItem(WM_ADDRESS_KEY) || '';
  wmLoadFolder('inbox');
  wmRefreshCounts();
}

function wmSwitchFolder(folder) {
  wmCurrentFolder = folder;
  document.querySelectorAll('.wm-folder-link').forEach((el) => {
    el.classList.toggle('active', el.dataset.folder === folder);
  });
  document.getElementById('wmComposePanel').style.display = 'none';
  document.getElementById('wmReadPanel').style.display = 'none';
  document.getElementById('wmListPanel').style.display = 'block';
  wmLoadFolder(folder);
}

async function wmLoadFolder(folder) {
  const listEl = document.getElementById('wmMessageList');
  const titleEl = document.getElementById('wmFolderTitle');
  const folderLabels = { inbox: 'Inbox', starred: 'Starred', sent: 'Sent', spam: 'Spam', trash: 'Trash' };
  titleEl.textContent = folderLabels[folder] || folder;
  listEl.innerHTML = '<div class="wm-empty">Loading…</div>';
  try {
    const res = await wmAuthedFetch(`/api/webmail/messages?folder=${folder}`);
    const data = await res.json();
    if (!res.ok) { listEl.innerHTML = `<div class="wm-empty">${data.error}</div>`; return; }
    wmCurrentMessages = data.messages || [];
    if (wmCurrentMessages.length === 0) {
      listEl.innerHTML = `<div class="wm-empty">No messages in ${folderLabels[folder] || folder}</div>`;
      return;
    }
    listEl.innerHTML = wmCurrentMessages.map((m) => `
      <div class="wm-msg-row" onclick="wmOpenMessage('${m.id}')">
        <span class="wm-star ${m.starred ? 'on' : ''}" onclick="event.stopPropagation(); wmToggleStar('${m.id}', ${!m.starred})">★</span>
        <span class="wm-msg-from">${m.direction === 'inbound' ? m.from : 'To: ' + m.to}</span>
        <span class="wm-msg-subject">${m.subject}</span>
        <span class="wm-msg-time">${new Date(m.at).toLocaleDateString()}</span>
      </div>`).join('');
  } catch (err) { /* redirected by wmAuthedFetch on 401 */ }
}

async function wmRefreshCounts() {
  try {
    const res = await wmAuthedFetch('/api/webmail/messages?folder=inbox');
    const data = await res.json();
    const badge = document.getElementById('wmInboxCount');
    if (badge) badge.textContent = (data.messages || []).length;
  } catch (err) { /* non-critical */ }
}

async function wmToggleStar(id, starred) {
  try {
    await wmAuthedFetch(`/api/webmail/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred })
    });
    wmLoadFolder(wmCurrentFolder);
  } catch (err) { /* redirected on 401 */ }
}

function wmOpenMessage(id) {
  const msg = wmCurrentMessages.find((m) => m.id === id);
  if (!msg) return;
  wmOpenMessageId = id;
  document.getElementById('wmListPanel').style.display = 'none';
  document.getElementById('wmReadPanel').style.display = 'block';
  document.getElementById('wmReadSubject').textContent = msg.subject;
  document.getElementById('wmReadFrom').textContent = msg.direction === 'inbound' ? msg.from : msg.to;
  document.getElementById('wmReadFromLabel').textContent = msg.direction === 'inbound' ? 'From' : 'To';
  document.getElementById('wmReadDate').textContent = new Date(msg.at).toLocaleString();
  document.getElementById('wmReadBody').textContent = msg.bodyText || '(no content)';

  const actions = document.getElementById('wmReadActions');
  const buttons = [];
  if (msg.folder !== 'spam') {
    buttons.push(`<button class="link-btn" onclick="wmMoveMessage('${msg.id}', 'spam')">Mark as spam</button>`);
  }
  if (msg.folder !== 'trash') {
    buttons.push(`<button class="danger" onclick="wmMoveMessage('${msg.id}', 'trash')">Move to trash</button>`);
  } else {
    buttons.push(`<button class="danger" onclick="wmDeleteMessage('${msg.id}')">Delete forever</button>`);
    buttons.push(`<button class="link-btn" onclick="wmMoveMessage('${msg.id}', 'inbox')">Move to inbox</button>`);
  }
  if (msg.direction === 'inbound') {
    buttons.unshift(`<button class="primary" onclick="wmStartReply('${msg.id}')">Reply</button>`);
  }
  actions.innerHTML = buttons.join(' ');
}

function wmBackToList() {
  document.getElementById('wmReadPanel').style.display = 'none';
  document.getElementById('wmListPanel').style.display = 'block';
}

async function wmMoveMessage(id, folder) {
  try {
    await wmAuthedFetch(`/api/webmail/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder })
    });
    wmBackToList();
    wmLoadFolder(wmCurrentFolder);
  } catch (err) { /* redirected on 401 */ }
}

async function wmDeleteMessage(id) {
  if (!confirm('Delete this message permanently? This cannot be undone.')) return;
  try {
    await wmAuthedFetch(`/api/webmail/messages/${id}`, { method: 'DELETE' });
    wmBackToList();
    wmLoadFolder(wmCurrentFolder);
  } catch (err) { /* redirected on 401 */ }
}

function wmOpenCompose() {
  document.getElementById('wmListPanel').style.display = 'none';
  document.getElementById('wmReadPanel').style.display = 'none';
  document.getElementById('wmComposePanel').style.display = 'block';
  document.getElementById('wmComposeTo').value = '';
  document.getElementById('wmComposeSubject').value = '';
  document.getElementById('wmComposeBody').value = '';
  document.getElementById('wmComposeResult').innerHTML = '';
}

function wmStartReply(id) {
  const msg = wmCurrentMessages.find((m) => m.id === id);
  if (!msg) return;
  wmOpenCompose();
  document.getElementById('wmComposeTo').value = msg.from;
  document.getElementById('wmComposeSubject').value = msg.subject.startsWith('Re: ') ? msg.subject : `Re: ${msg.subject}`;
}

function wmCancelCompose() {
  document.getElementById('wmComposePanel').style.display = 'none';
  document.getElementById('wmListPanel').style.display = 'block';
}

async function wmSendMessage() {
  const to = document.getElementById('wmComposeTo').value.trim();
  const subject = document.getElementById('wmComposeSubject').value.trim();
  const text = document.getElementById('wmComposeBody').value.trim();
  const resultEl = document.getElementById('wmComposeResult');
  if (!to || !subject || !text) { resultEl.innerHTML = '<p style="color:var(--danger)">To, subject, and message are all required.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted)">Sending…</p>';
  try {
    const res = await wmAuthedFetch('/api/webmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text })
    });
    const data = await res.json();
    if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--danger)">${data.error}</p>`; return; }
    resultEl.innerHTML = '<p style="color:var(--mail)">Sent.</p>';
    setTimeout(() => { wmCancelCompose(); wmSwitchFolder('sent'); }, 600);
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}
