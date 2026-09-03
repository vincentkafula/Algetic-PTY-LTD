import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { wmAuthedFetch as rawWmAuthedFetch, wmIsLoggedIn } from './webmailApi';

export function useRequireWebmailSession() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!wmIsLoggedIn()) navigate('/webmail-login', { replace: true });
  }, [navigate]);
}

export function useWebmailAuthedFetch() {
  const navigate = useNavigate();
  return useCallback(
    async (url, options) => {
      try {
        return await rawWmAuthedFetch(url, options);
      } catch (err) {
        if (err.sessionExpired) navigate('/webmail-login', { replace: true });
        throw err;
      }
    },
    [navigate]
  );
}
