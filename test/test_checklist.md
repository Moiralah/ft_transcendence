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
- [ ] Google OAuth login → lands back on the app logged in
  - Notes:
- [ ] GitHub OAuth login → lands back on the app logged in
  - Notes:
- [ ] OAuth login for a user that **already has 2FA enabled** → prompts for
      a code on the `/consent` page instead of skipping straight in
  - Notes:
- ⚠️ Blocked locally: no Google/GitHub client credentials configured in
  local Supabase yet — this can currently only be tested against the
  shared dev DB, or after adding local OAuth app credentials. See
  `progress_log.md` Session 3.

## 3. Two-Factor Authentication (2FA)
- [x] **(backend verified)** `/settings/2fa` shows disabled state, "Enable
      2FA" generates a QR code + manual secret
  - Notes: curl-verified `/2fa/setup` returns secret + otpauth URL + QR
    data URL; UI render itself not yet clicked through.
- [ ] Scan the QR with a real authenticator app (Google Authenticator,
      Authy, etc.) — does the code it generates actually work?
  - Notes:
- [x] **(backend verified)** Confirming with a valid 6-digit code enables
      2FA and shows 8 recovery codes exactly once
  - Notes:
- [ ] Recovery codes are only shown once — refreshing/revisiting doesn't
      show them again
  - Notes:
- [x] **(backend verified)** Logging out and back in now prompts for a 2FA
      code instead of logging straight in
  - Notes:
- [x] **(backend verified)** Wrong 2FA code is rejected with a clear error
  - Notes:
- [x] **(backend verified)** Correct TOTP code logs you in
  - Notes:
- [x] **(backend verified)** A recovery code works exactly once — same
      code rejected on a second attempt
  - Notes:
- [ ] "Use a recovery code instead" toggle in the login UI actually works
  - Notes:
- [x] **(backend verified)** Disabling 2FA (with a valid code) turns it off
      and clears the recovery codes; login goes back to not requiring a code
  - Notes:
- [x] Trying to disable 2FA with a wrong code is rejected
  - Notes:

## 4. Global roles / Admin panel
- [x] **(backend verified)** Promoting a user to `ADMIN` requires a direct
      DB update — cannot self-promote through the UI/API
  - Notes:
- [ ] `/admin/users` loads and lists all users when logged in as `ADMIN`
  - Notes:
- [ ] `/admin/users` redirects away for a non-admin user
  - Notes:
- [x] **(backend verified)** A non-admin JWT hitting `GET /api/users`
      directly gets a 403
  - Notes:
- [ ] Changing another user's role via the dropdown works and reflects
      immediately
  - Notes:
- [x] **(backend verified)** An admin cannot change their own role (self
      demotion blocked with a 403)
  - Notes:
- [ ] Deleting a user via the UI works, with a confirm step
  - Notes:
- [ ] Deleting a user who has profiles/audit logs/invitations gives a clean
      error instead of a raw 500
  - Notes:
- [ ] "Admin Panel" link on `/dashboard` only shows up for admins
  - Notes:

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
