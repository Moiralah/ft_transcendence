# Test Checklist

Whole-app manual test checklist, grouped by feature (matches the modules in
`backend.md`/`frontend.md`). Check items off as you go, add notes under
anything that's broken/weird/blocked. Items marked **(backend verified)**
already passed a curl-level smoke test against a local DB in
`progress_log.md` Session 3 — they still need a real click-through in the
browser, that's a different thing than the backend logic being correct.

Legend: `- [ ]` untested · `- [x]` passed · mark failures `- [ ] ❌` and say
why in the Notes line.

---

## 1. Core auth (email/password)

- [ ] Sign up with a new email/password
  - Notes:
- [ ] Log in with correct credentials
  - Notes:
- [ ] Log in with wrong password → clear error, no crash
  - Notes:
- [ ] Session persists on page refresh (localStorage `ft_token`)
  - Notes:

## 2. OAuth (Google / GitHub)

- [X] Google OAuth login → lands back on the app logged in
  - Notes: confirmed live end-to-end (Session 6) — required setting up a
    GCP OAuth client + local Supabase config from scratch (see README
    "Running Supabase Locally" section's Google OAuth steps), fixing a
    real code bug along the way (`login/page.tsx` was redirecting to
    `/auth/callback`, a route that never existed — changed to
    `/consent`), and a `SUPABASE_AUTH_URL` env-var reset bug on the
    backend side. User confirmed landing on `/dashboard` after a real
    Google sign-in. `tiarabyte@gmail.com` confirmed in the local DB with
    `providers: ["google"]`.
- [X] GitHub OAuth login → lands back on the app logged in
  - Notes: confirmed live end-to-end. User created their own GitHub
    OAuth App, same Supabase callback URL as Google
    (`http://127.0.0.1:54321/auth/v1/callback`). Verified server-side,
    not just "it worked": `auth.users.last_sign_in_at` for
    `natsching@gmail.com` matched within ~90 seconds of the login,
    `providers: ["github"]`, and confirmed our own backend correctly
    created the local `User` row (`role: USER` default) at the same
    timestamp — not just a Supabase-level success.
- [X] OAuth login for a user that **already has 2FA enabled** → prompts for
  a code on the `/consent` page instead of skipping straight in
  - Notes: confirmed live. Enabled 2FA on the GitHub-linked account
    (`natsching@gmail.com`, confirmed `twoFactorEnabled: true` in the DB),
    signed out, signed back in via GitHub — user confirmed it prompted
    for a code instead of skipping straight to the dashboard. Backend
    mechanics of code entry/verification already covered in §3.

## 3. Two-Factor Authentication (2FA)

- [X] **(backend verified)** `/settings/2fa` shows disabled state, "Enable
  2FA" generates a QR code + manual secret
  - Notes: curl-verified `/2fa/setup` returns secret + otpauth URL + QR
    data URL; UI render itself not yet clicked through.
- [X] Scan the QR with a real authenticator app (Google Authenticator,
  Authy, etc.) — does the code it generates actually work?
  - Notes:
- [X] **(backend verified)** Confirming with a valid 6-digit code enables
  2FA and shows 8 recovery codes exactly once
  - Notes:
- [X] **(code verified)** Recovery codes are only shown once — refreshing/
  revisiting doesn't show them again
  - Notes: read `settings/2fa/page.tsx` directly — `recoveryCodes` lives
    only in plain React `useState`, never written to `localStorage` or
    anywhere durable, and the backend has no endpoint to re-fetch them
    (only bcrypt hashes are stored, unrecoverable in plaintext). A
    refresh or navigating away resets that state to nothing structurally,
    not just "should" — there's no code path that could show them again.
    No browser automation available in this environment to click through
    it live (chromium-cli isn't installed); safe to trust the code read
    here since the guarantee doesn't depend on runtime behavior.
- [X] **(backend verified)** Logging out and back in now prompts for a 2FA
  code instead of logging straight in
  - Notes:
- [X] **(backend verified)** Wrong 2FA code is rejected with a clear error
  - Notes:
- [X] **(backend verified)** Correct TOTP code logs you in
  - Notes:
- [X] **(backend verified)** A recovery code works exactly once — same
  code rejected on a second attempt
  - Notes:
- [X] "Use a recovery code instead" toggle in the login UI actually works
  - Notes:
- [X] **(backend verified)** Disabling 2FA (with a valid code) turns it off
  and clears the recovery codes; login goes back to not requiring a code
  - Notes:
- [X] Trying to disable 2FA with a wrong code is rejected
  - Notes:

## 4. Global roles / Admin panel

- [X] **(backend verified)** Promoting a user to `ADMIN` requires a direct
  DB update — cannot self-promote through the UI/API
  - Notes:
- [X] `/admin/users` loads and lists all users when logged in as `ADMIN`
  - Notes:
- [X] **(code verified)** `/admin/users` redirects away for a non-admin
  user
  - Notes: `admin/users/page.tsx` has two layers — a client-side check
    (`if (role !== 'ADMIN') router.push('/dashboard')`) on mount, *and* a
    fallback in `fetchUsers()` that also redirects if the API itself
    returns `403`. Real defense-in-depth, not just a UI-level check that
    a forged `ft_role` in localStorage could bypass.
- [X] **(backend verified)** A non-admin JWT hitting `GET /api/users`
  directly gets a 403
  - Notes:
- [X] **(code verified)** Changing another user's role via the dropdown
  works and reflects immediately
  - Notes: `changeRole()` calls the `PATCH`, and on success does
    `setUsers(prev => prev.map(...))` to update React state directly —
    no refetch needed, updates immediately by construction.
- [X] **(backend verified)** An admin cannot change their own role (self
  demotion blocked with a 403)
  - Notes:
- [X] **(code verified)** Deleting a user via the UI works, with a confirm
  step
  - Notes: `deleteUser()` uses a real `confirm()` dialog before calling
    `DELETE`, removes from the local list on success. Only works for a
    user who has never created/joined a tree — see next item, this isn't
    an edge case in practice.
- [x] Deleting a user who has profiles/audit logs/invitations gives a clean
  error instead of a raw 500
  - Notes: confirmed — but the scope is much bigger than the item title
    implies. `AuditLog.userId` is `ON DELETE RESTRICT`, and an `AuditLog`
    row gets created on `CREATE_TREE`/`JOIN_TREE` (`tree.service.ts:78,117`).
    Since that's the core action of the whole app, **any user who has
    actually used the product becomes permanently undeletable**, not just
    users with unusual history. User confirmed this live: tried deleting a
    real test account, got the clean 409 (not a 500 — so this exact
    checklist item technically passes), but the underlying UX is that the
    "Delete user" button doesn't really work for real users. Flagged for
    whoever owns `tree.service.ts`'s ownership model (Moiralah/Leong Kin
    Chan per `backend.md`) — not fixed, since deciding what happens to a
    deleted user's trees (orphan/reassign/cascade) is a real design call,
    not a 2FA/roles change. See `progress_log.md`.
- [X] **(code verified)** "Admin Panel" link on `/dashboard` only shows up
  for admins
  - Notes: `{role === 'ADMIN' && (<Button href="/admin/users">...)}` —
    clean conditional render, correct by construction.

## 5. Trees (organization system)

- [ ] Create a new tree
  - Notes:
- [ ] Join an existing tree (search + join flow)
  - Notes:
- [ ] `/dashboard` lists all trees you belong to
  - Notes:
- [ ] View tree members and their per-tree roles
  - Notes:
- [ ] Change a member's per-tree role (`PUT /:id/role/:targetProfileId`)
  - Notes:
- [ ] Add a child node to the tree
  - Notes:
- [ ] Add a spouse to a node
  - Notes:
- [ ] Leave a tree
  - Notes:
- [ ] Edit/delete a tree (admin only) — check if this is actually built,
  README lists it as still in-progress
  - Notes:

## 6. Profiles (person records)

- [ ] View your own profile (`GET /me`)
  - Notes:
- [ ] Create a new profile/person
  - Notes:
- [ ] Edit a profile
  - Notes:
- [ ] Delete a profile
  - Notes:
- [ ] Fetch a subtree from a given root profile
  - Notes:

## 7. Tree visualization — two implementations, test both

- [ ] `/viewtree` renders the family tree diagram correctly
  - Notes:
- [ ] `/canvas/[id]` renders the family tree diagram correctly
  - Notes:
- [ ] Figure out which one (if either) is actually linked to from
  `/dashboard` — see the note in `frontend.md`, these look like two
  separate unconnected implementations
  - Notes:
- [ ] Confirm `/tree/page.tsx` is genuinely dead/unused before anyone
  deletes it (known broken import, won't compile)
  - Notes:

## 8. Design system / landing page

- [ ] Landing page (`/`) renders all sections correctly
  - Notes:
- [ ] Buttons, nav, footer, modals — basic visual sanity check across pages
  - Notes:
- [ ] `SkipLink` (accessibility skip-to-content) actually works with
  keyboard-only navigation
  - Notes:

## 9. Cross-cutting

- [ ] Browser console is clean (no errors/warnings) across every page
  you touch above — this is an explicit subject requirement
  - Notes:
- [ ] `make` starts the whole stack cleanly from a fresh checkout
  - Notes:
- [ ] Backend cert + frontend cert both need manual browser approval on
  first run (`https://localhost:4000`, `https://localhost:3000`) — note
  if this trips up a fresh teammate
  - Notes:

## 10. Not built yet — don't test, just confirm still not built

Skip these, they're not implemented per the README (flagging so nobody
wastes time testing something that doesn't exist yet):

- [ ] Real-time features (chat, live updates) — Maira, not started
- [ ] Notification system — Maira, not started
- [ ] Public API (API key, rate limiting, docs) — Person C, not started
- [ ] Advanced search (filters/sort/pagination) — Person C, not started
- [ ] Avatar upload, friends system, online status — John, not started
- [ ] Accessibility (WCAG 2.1 AA) audit/fixes — John, not started
- [ ] Additional browser testing (Firefox/Safari/Edge) — John, not started

## 11. Cybersecurity — WAF + Vault

Unlike the sections above, this one's mostly terminal commands, not
browser clicks — copy-paste these and check the output matches. See
`diagram/architecture.html` for the visual, `README.md`'s "WAF
(Cybersecurity module)" section for the full explanation.

- [x] Bring the WAF up: `make security` (builds + starts everything,
  including the base stack if it wasn't already running)
  - Notes: verified.
- [x] **Gotcha check #1** — confirm the backend didn't silently lose its
  DB connection (it does this on basically every `docker compose up`
  that touches `backend`):
  ``bash docker exec transpeed-backend-1 sh -c 'echo $DATABASE_URL' ``
  Must say `host.docker.internal`, not `127.0.0.1`. If it says
  `127.0.0.1`, re-run the override command in the README's "Running
  Supabase Locally" section before continuing.
  - Notes: confirmed this gotcha fires on basically every `docker compose
    up` touching backend — hit it again during Vault work too. Fix works
    every time.
- [x] **Gotcha check #2** — if `backend`/`frontend` were recreated at any
  point while the WAF was already up (e.g. you just fixed gotcha #1
  above), the WAF's nginx is now pointing at a dead IP. Restart it:
  ``bash docker restart transpeed-waf-backend-1 transpeed-waf-frontend-1 ``
  - Notes: confirmed, `502` before the restart → `401` after.
- [x] Baseline — a normal request through the WAF reaches the real app
  (same response as hitting the backend directly would give):
  ``bash curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:9443/api/auth/2fa/status ``
  Expect `401` (not `502`/`403`) — that's the app itself correctly
  rejecting an unauthenticated request, proving the request actually
  got through the WAF.
  - Notes: `401` confirmed, multiple times across the session.
- [x] SQL injection gets blocked:
  ``bash curl -sk -w "\n%{http_code}\n" "https://localhost:9443/api/trees/search?name=smith'%20OR%20'1'='1" ``
  Expect `403 Forbidden`.
  - Notes: `403` confirmed.
- [x] XSS gets blocked:
  ``bash curl -sk -w "\n%{http_code}\n" "https://localhost:9443/api/trees/search?name=<script>alert(1)</script>" ``
  Expect `403 Forbidden`.
  - Notes: `403` confirmed.
- [x] Confirm the WAF is actually what's blocking it — the exact same
  payload reaches the app unfiltered when sent directly, bypassing
  the WAF (this should currently succeed / not 403, since direct
  access isn't locked down yet — see README):
  ``bash curl -sk -o /dev/null -w "%{http_code}\n" "https://localhost:4000/api/trees/search?name=smith'%20OR%20'1'='1" ``
  - Notes: confirmed — reaches the app (currently `500`, see the
    `/api/trees/search` bug noted in section 4/progress_log, unrelated to
    the WAF). Proves the WAF specifically is what blocks it on `:9443`,
    not something else in the request path.
- [x] (Optional) See *why* it blocked something — ModSecurity logs the
  matched rule and reasoning as JSON:
  ``bash docker logs transpeed-waf-backend-1 --tail 5 ``
  Look for `"message":"SQL Injection Attack Detected via libinjection"`
  or similar.
  - Notes: confirmed, full rule ID/message/matched-data all present in the
    JSON log line.
- [x] Frontend WAF works too (same idea, simpler check — just confirm it
  loads):
  ``bash curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:8443/ ``
  Expect `200`.
  - Notes: `200` confirmed.

### Vault (secrets management)

- [x] Confirm the backend actually loaded secrets from Vault, not `.env`
  fallback:
  ``bash docker logs transpeed-backend-1 | grep vault ``
  Expect `[vault] loaded 5 secrets from secret/data/family-tree/backend`.
  - Notes: confirmed, exact message present.
- [x] Confirm the app actually works using those Vault-sourced secrets
  (not just that they loaded) — a real login exercises the Vault-sourced
  `DATABASE_URL` (Prisma query) and `SUPABASE_AUTH_URL` (token
  verification) in one request:
  ``bash curl -sk -X POST https://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"accessToken":"<a real supabase access token>"}' ``
  Expect a normal response (session or `twoFactorRequired`), not `Invalid
  Supabase token` or a Prisma connection error.
  - Notes: confirmed with `tester1`'s real password-grant token, got
    `twoFactorRequired` back — proves both Vault-sourced values actually
    work, not just that they're set.
- [x] Confirm least-privilege — the backend's AppRole token can read its
  own secret but nothing else in Vault (this proves it's not using the
  root token):
  ``bash # get a token the same way the backend does, then: curl -s -H "X-Vault-Token: <that token>" http://127.0.0.1:8200/v1/sys/mounts ``
  Expect `permission denied`, not a list of mounts. (`scripts/vault-init.sh`
  prints the role/secret IDs if you need to regenerate a token manually.)
  - Notes: confirmed — reads its own secret fine, `permission denied` on
    `sys/mounts`.
- [x] Stop and restart just the `vault` container, then re-run
  `make security` — confirm it re-bootstraps cleanly (this is expected:
  dev-mode Vault is in-memory, nothing persists):
  ``bash docker restart transpeed-vault-1 && ./scripts/vault-init.sh ``
  - Notes: **this one caught a real bug** — backend crashed on boot the
    first time (`404` reading its own secret, root cause: CRLF in `.env`
    breaking `vault-init.sh`'s JSON payload). Fixed with `tr -d '\r'` in
    the script, re-ran, clean boot confirmed after the fix. See
    `progress_log.md` for the full trace.
  - Notes:
