// Mirrors the vanilla-JS auth.js exactly — same localStorage keys, same
// token/redirect behavior — so the backend contract (already tested
// end-to-end throughout this project) doesn't need to change at all.
const TOKEN_KEY = 'altegic_token';
const USER_KEY = 'altegic_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
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
 * (expired/invalid session), clears the session and throws — callers in
 * React components should catch this and navigate to /login (can't do a
 * hard window.location redirect here the way the vanilla app.js did,
 * since React Router should own navigation).
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
