'use client';

// ---------------------------------------------------------------------------
// Ported from the Vite app's src/lib/api.js. Same localStorage keys, same
// token/redirect behavior, so the backend contract (already tested
// end-to-end throughout the Next.js migration) doesn't need to change.
// Every function here is client-only (localStorage doesn't exist during
// Next.js's server-side rendering pass) — callers must be in a component
// marked 'use client', and should guard direct localStorage access with a
// typeof window check if called during render rather than in an effect
// or event handler.
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'altegic_token';
const USER_KEY = 'altegic_user';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
  return Boolean(getToken());
}

/**
 * Wrapper around fetch() that attaches the bearer token. On a 401
 * (expired/invalid session), clears the session and throws — callers
 * should catch this and navigate to /login via next/navigation's
 * useRouter (can't do a hard redirect here since this isn't a component).
 */
export async function authedFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    const err = new Error('Session expired');
    err.sessionExpired = true;
    throw err;
  }
  return res;
}
