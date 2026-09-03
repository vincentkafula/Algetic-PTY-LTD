// Session management for the mailbox-level webmail login — deliberately
// SEPARATE from src/lib/api.js (which manages the Altegic account
// session). A mailbox owner and an Altegic account holder are not the
// same login, even when they happen to be the same person. Same
// localStorage keys as the vanilla webmail.js, so nothing about the
// already-tested backend contract changes.
const WM_TOKEN_KEY = 'altegic_webmail_token';
const WM_ADDRESS_KEY = 'altegic_webmail_address';

export function wmGetToken() {
  return localStorage.getItem(WM_TOKEN_KEY);
}

export function wmGetAddress() {
  return localStorage.getItem(WM_ADDRESS_KEY) || '';
}

export function wmSetSession(token, address) {
  localStorage.setItem(WM_TOKEN_KEY, token);
  localStorage.setItem(WM_ADDRESS_KEY, address);
}

export function wmClearSession() {
  localStorage.removeItem(WM_TOKEN_KEY);
  localStorage.removeItem(WM_ADDRESS_KEY);
}

export function wmIsLoggedIn() {
  return Boolean(wmGetToken());
}

export async function wmAuthedFetch(url, options = {}) {
  const token = wmGetToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    wmClearSession();
    const err = new Error('Session expired');
    err.sessionExpired = true;
    throw err;
  }
  return res;
}
