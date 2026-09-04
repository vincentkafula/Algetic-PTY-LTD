'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch as rawAuthedFetch, isLoggedIn } from './clientAuth';

// ---------------------------------------------------------------------------
// Ported from the Vite app's src/lib/useAuthedFetch.js. Only real change:
// next/navigation's useRouter instead of react-router-dom's useNavigate —
// same behavior (redirect to /login on missing/expired session), different
// router API.
// ---------------------------------------------------------------------------

/**
 * Use at the top of any component that requires an active account session.
 */
export function useRequireAuth() {
  const router = useRouter();
  useEffect(() => {
    if (!isLoggedIn()) router.replace('/login');
  }, [router]);
}

/**
 * Returns a fetch function that attaches the auth token and automatically
 * navigates to /login on a 401.
 */
export function useAuthedFetch() {
  const router = useRouter();
  return useCallback(
    async (url, options) => {
      try {
        return await rawAuthedFetch(url, options);
      } catch (err) {
        if (err.sessionExpired) router.replace('/login');
        throw err;
      }
    },
    [router]
  );
}
