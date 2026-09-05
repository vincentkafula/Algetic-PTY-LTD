import { Suspense } from 'react';
import '@/styles/dashboard.css';
import CheckoutReturnContent from '@/components/checkout/CheckoutReturnContent';

// ---------------------------------------------------------------------------
// Ported from the Vite app's CheckoutReturn.jsx. Real Next.js-specific
// requirement, verified against current Next.js documentation before
// building this (not assumed): a Client Component using useSearchParams()
// must be wrapped in a Suspense boundary, or the production build fails
// outright with "Missing Suspense boundary with useSearchParams" — a
// pure client-side Vite SPA never had this constraint, since there was no
// build-time prerendering step to trip over it. The actual polling logic
// lives in CheckoutReturnContent, kept as a separate Client Component
// specifically so it can be the thing wrapped here.
// ---------------------------------------------------------------------------

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading…</div>}>
      <CheckoutReturnContent />
    </Suspense>
  );
}
