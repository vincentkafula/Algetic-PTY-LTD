'use client';

// ---------------------------------------------------------------------------
// Ported from the Vite app's src/lib/webmailApi.js. Session management for
// the mailbox-level webmail login — deliberately SEPARATE from
// src/lib/clientAuth.js (which manages the Altegic account session). Same
// localStorage keys as the Vite version, so the already-tested backend
// contract doesn't change. Same typeof-window guards as clientAuth.js —
// localStorage doesn't exist during Next.js's server-rendering pass.
// ---------------------------------------------------------------------------

const WM_TOKEN_KEY = 'altegic_webmail_token';
const WM_ADDRESS_KEY = 'altegic_webmail_address';

export function wmGetToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WM_TOKEN_KEY);
}

export function wmGetAddress() {
  if (typeof window === 'undefined') return '';
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
