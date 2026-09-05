'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { wmAuthedFetch as rawWmAuthedFetch, wmIsLoggedIn } from './webmailApi';

export function useRequireWebmailSession() {
  const router = useRouter();
  useEffect(() => {
    if (!wmIsLoggedIn()) router.replace('/webmail-login');
  }, [router]);
}

export function useWebmailAuthedFetch() {
  const router = useRouter();
  return useCallback(
    async (url, options) => {
      try {
        return await rawWmAuthedFetch(url, options);
      } catch (err) {
        if (err.sessionExpired) router.replace('/webmail-login');
        throw err;
      }
    },
    [router]
  );
}
