import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authedFetch as rawAuthedFetch, isLoggedIn } from './api';

/**
 * Use at the top of any component that requires an active account
 * session — mirrors the vanilla app's requireSession() but as a proper
 * React effect (runs once on mount, navigates via React Router instead
 * of a hard page reload).
 */
export function useRequireAuth() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoggedIn()) navigate('/login', { replace: true });
  }, [navigate]);
}

/**
 * Returns a fetch function that attaches the auth token and automatically
 * navigates to /login on a 401 — the React-Router-aware equivalent of the
 * vanilla app's authedFetch, which did a hard window.location redirect.
 */
export function useAuthedFetch() {
  const navigate = useNavigate();
  return useCallback(
    async (url, options) => {
      try {
        return await rawAuthedFetch(url, options);
      } catch (err) {
        if (err.sessionExpired) navigate('/login', { replace: true });
        throw err;
      }
    },
    [navigate]
  );
}
