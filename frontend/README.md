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
- **The full Dashboard — all seven panels**, each a real React
  component with its own state (not one giant file): Mailboxes
  (+ per-mailbox messages/compose), Phone numbers (+ SIP trunk),
  Private SIP network, Call Centre (menus/queues/agents/number
  assignment — the largest single panel), Domains (search → quote
  with agreement checkboxes → register, + DNS records), Website/
  software/internet request tracker, and the MVNO demo dashboard

**Verified for real:** `npm run build` succeeds with zero errors across
all three routes (`/`, `/login`, `/dashboard`); every one of the ~40
distinct API endpoint calls in the original `app.js` was cross-checked
line-by-line against the React source and confirmed present with correct
parameterization — full 1:1 API coverage, not just "it builds." All
three routes confirmed to serve the correct app shell via Vite preview.
**Not verified:** actual in-browser rendering/click-through — no
headless browser available in the development sandbox.

**NOT started yet:**
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
