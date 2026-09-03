# Altegic frontend — React

The backend (`server.js` and everything else one level up) is Node/Express,
unchanged by this conversion. This directory is a from-scratch React port
of what used to be vanilla HTML/CSS/JS directly in `server/public/` —
every page converted, and now wired into the live build.

**This directory lives inside `server/`, not as a sibling.** Railway's
`rootDirectory` is scoped to `server/`, so a sibling `frontend/` next to
`server/` would be entirely invisible to Railway's build — that mistake
broke the very first deploy attempt of this integration. Moving it in
here fixed it with zero Railway project-config changes.

## Building

```bash
npm install
npm run build
```

Output goes to `../public` (i.e. `server/public`), which `server.js`
serves via `express.static` plus an SPA-fallback route for client-side
routing (`/dashboard`, `/webmail`, etc. all resolve to the same
`index.html`, and React Router takes it from there).

`server/package.json`'s own `build` script (`cd frontend && npm install
&& npm run build`) does exactly this automatically — Railway runs it
before every deploy via Railpack's standard Node build-step detection.
No `frontend`-specific configuration exists in Railway's project settings
at all; it's entirely driven by `server/package.json`.

For local iteration, `npm run dev` runs Vite's dev server directly
(faster reloads), but it talks to the API at whatever origin `server.js`
is running on — check `src/lib/api.js` / `src/lib/webmailApi.js` if you
need to point it elsewhere.

## What's here

- `src/pages/Landing.jsx`, `Login.jsx` — public pages
- `src/pages/dashboard/` — the authenticated app: `Dashboard.jsx` (shell)
  plus one component per panel (Mailboxes, Voice, SIP Network, Call
  Centre, Domains, Projects, MVNO)
- `src/pages/webmail/` — the separate mailbox-owner product
  (`WebmailLogin.jsx`, `WebmailInbox.jsx`)
- `src/lib/api.js` + `useAuthedFetch.js` — the Altegic account session
  (mirrors the original vanilla `auth.js`'s exact localStorage keys)
- `src/lib/webmailApi.js` + `useWebmailAuthedFetch.js` — the
  **independent** mailbox/webmail session — deliberately a separate
  system from the account session above, matching the backend's own
  `middleware/auth.js` vs `middleware/mailboxAuth.js` split
- `src/styles/` — the ported design system (same tokens/classes the
  original vanilla site used, so nothing visually changed by this
  conversion)

## Verification notes

Every page was converted with 1:1 API coverage confirmed against the
original vanilla JS, line by line — not just "it builds." Both
independent auth systems' localStorage keys were confirmed present and
distinct in the compiled bundle. The full request/response cycle (build
→ serve → API → auth → CRUD → SPA routing → static assets → 404
handling) was tested against a real running server after the final
integration.

**What was not verified:** actual in-browser rendering — no headless
browser was available in the development sandbox this was built in.
Confirm that for real before trusting this fully.
