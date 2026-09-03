# Altegic frontend — React conversion (in progress)

The backend (`server/`) is already Node/Express and unchanged. This
directory is a from-scratch React port of the frontend, replacing the
vanilla HTML/CSS/JS in `server/public/`.

**Given the scale — 5 major page-groups, one of them (the dashboard) with
seven independent panels — this is being built the same way every other
large feature in this project was: foundation first, verified, then
converted incrementally, rather than one giant unverified rewrite.**

## Status

**Done, built, and verified:**
- Vite + React + React Router scaffold, building cleanly with no errors
- `src/lib/api.js` / `src/lib/useAuthedFetch.js` — the account-auth client,
  deliberately mirroring `server/public/auth.js`'s exact localStorage keys
  and behavior, so the already-tested backend contract doesn't change
- `src/styles/global.css` — direct port of `server/public/styles.css`
  (same design tokens, same component classes: `.panel-box`, `.hud`
  corner-brackets, `.status-banner`, etc.)
- `src/pages/Login.jsx` — full port of `login.html`, same fields, same
  API calls, same redirect behavior, using React state instead of direct
  DOM manipulation
- `src/pages/Landing.jsx` — full port of `index.html`, including the
  animated radar-sweep hero graphic, all seven service cards, pricing,
  team, and footer — built data-driven (arrays mapped to JSX) for the
  repetitive card grids rather than hand-transcribed markup, to reduce
  transcription errors across ~300 lines of near-identical structure

**Verified for real:** `npm run build` succeeds with zero errors; both
`/` and `/login` correctly serve the app shell (confirmed via Vite
preview's SPA fallback); the compiled JS bundle was checked to contain
the exact correct API endpoint strings (`/api/auth/login`,
`/api/auth/signup`) matching the backend routes already tested
extensively elsewhere in this project. **Not verified:** actual
in-browser rendering/click-through — no headless browser is available in
the development sandbox, so this needs a real browser check before
trusting it fully.

**NOT started yet:**
- `/dashboard` — the seven-panel authenticated app (Mailboxes, Phone
  numbers, Private SIP network, Call centre, Domains, Website/software/
  internet requests, MVNO demo) — by far the largest remaining piece
- `/webmail-login` and `/webmail` — the separate mailbox-owner login and
  inbox product

## Deployment — deliberately NOT wired up yet

`server/public/` still has the working vanilla-JS site, and Railway is
still serving that. This `frontend/` directory is not yet connected to
the live deployment in any way — no risk to the live site from this work
in progress.

**The plan once the conversion is complete:** point Vite's `build.outDir`
at `server/public` (replacing the vanilla files), add an SPA-fallback
catch-all route in `server.js` (serve `index.html` for any non-`/api`
path, so React Router's client-side routing works on a hard refresh/
direct link), and add a `build` script to `server/package.json` so
Railway's existing build step (rootDirectory `server`, Railpack) builds
the React app automatically — no change to Railway's project
configuration itself.
