# Progress Log — Person D (Advanced Permissions + 2FA)

## 2026-09-17, ~22:00 — Session 1: schema + backend roles + backend 2FA (in progress)

Plan agreed with user (full plan also saved separately by Claude Code at
`/Users/tnc/.claude/plans/twinkly-wishing-horizon.md`):

- 2FA = custom backend TOTP (not Supabase native MFA), because recovery codes
  need to live in our own DB and it has to slot into the existing
  `/auth/login` Supabase-token hand-off.
- Schema changes are written by Claude, but `npx prisma db push` /
  `prisma generate` against the shared Supabase dev DB is run by the user,
  not automatically.

### Done so far

**Schema** (`backend/src/prisma/schema.prisma`)
- Added `role UserRole @default(USER)` to `User` (new enum `UserRole`:
  ADMIN / MODERATOR / USER — separate from the existing per-tree `Role` enum
  used by `TreeMember`).
- Added `twoFactorEnabled Boolean`, `twoFactorSecret String?`,
  `recoveryCodes RecoveryCode[]` to `User`.
- Added new `RecoveryCode` model (id, userId, codeHash, usedAt, createdAt),
  cascade-deletes with User.
- **Not yet applied to the DB** — still needs `npx prisma db push` +
  `npx prisma generate` from someone with the real `DATABASE_URL`/`DIRECT_URL`.

**Backend — global roles**
- `backend/src/api/auth/roles.decorator.ts` — new `@Roles(...roles)` decorator.
- `backend/src/api/auth/roles.guard.ts` — new `RolesGuard` (checks
  `request.user.role` against `@Roles(...)` metadata).
- `backend/src/api/auth/jwt.strategy.ts` — now returns `role` in the
  validated user object; rejects any token with `purpose: 'mfa'` (so a 2FA
  challenge token can never be reused as a normal bearer token).
- `backend/src/api/auth/auth.service.ts` — JWTs now carry `role`; added
  `issueSession(user)` helper (shared by normal login and 2FA login-verify);
  `loginWithSupabaseToken` now short-circuits into a 2FA challenge when
  `user.twoFactorEnabled` is true instead of returning a full session.
- New `backend/src/api/users/` module (`users.module.ts`,
  `users.controller.ts`, `users.service.ts`, `dto/update-role.dto.ts`):
  - `GET /api/users` — list all users (admin only).
  - `PATCH /api/users/:id/role` — change a user's role (admin only, can't
    change your own role).
  - `DELETE /api/users/:id` — delete a user (admin only, can't delete
    yourself; returns a clean 409 instead of a raw 500 if the user still has
    profiles/audit logs/invitations referencing them).
  - Registered in `backend/src/app.module.ts`.

**Backend — 2FA**
- New `backend/src/api/auth/two-factor/` (`two-factor.service.ts`,
  `two-factor.controller.ts`, `dto/two-factor.dto.ts`), registered from
  `auth.module.ts`.
- Routes under `/api/auth/2fa`: `GET status`, `POST setup` (generates TOTP
  secret + QR code via `otplib`/`qrcode`), `POST enable` (verifies code,
  turns 2FA on, issues 8 bcrypt-hashed recovery codes, returns them once in
  plaintext), `POST disable` (requires a valid code first), `POST
  login-verify` (exchanges a `{challengeToken, code}` pair — TOTP or a
  recovery code — for a real session).
- Added `otplib`, `qrcode` (+ `@types/qrcode` dev dep) to
  `backend/package.json`.
- **Not yet installed** — this environment has no local `node`/`npm` (only
  Docker), so `npm install` for these new deps needs to happen via a backend
  container rebuild (`docker compose build backend` or equivalent), not run
  yet.

**Frontend**
- New `frontend/src/lib/auth.ts` — shared helpers `exchangeSupabaseToken()`
  and `verifyTwoFactorLogin()`, plus `storeSession()`/`clearSession()` for
  `ft_token`/`ft_role` in localStorage. This was the only frontend file
  written before pausing.

## 2026-09-18, ~08:30 — Session 2: frontend wiring, plan complete

All remaining frontend items from the plan are now done:

- `frontend/src/components/twoFactorPrompt.tsx` — shared inline code-entry
  form (TOTP or recovery code) used during login.
- `frontend/src/app/login/page.tsx` — now goes through
  `exchangeSupabaseToken()`; on `twoFactorRequired` it renders
  `TwoFactorPrompt` in place of the login form instead of navigating away.
- `frontend/src/app/consent/page.tsx` (OAuth callback) — same
  `twoFactorRequired` handling, since an OAuth login can belong to an
  existing user who has 2FA turned on.
- `frontend/src/app/signup/page.tsx` — switched to the shared helper too
  (a brand-new signup can never actually hit the 2FA branch, but it's
  handled defensively).
- All three now call `storeSession()`, which sets both `ft_token` and
  `ft_role` in localStorage (previously only the token was stored).
- New `frontend/src/app/settings/2fa/page.tsx` — status check, QR-code
  enrollment + confirm, one-time recovery-codes reveal, disable flow.
- New `frontend/src/app/admin/users/page.tsx` — table of all users, role
  `<select>` → `PATCH /users/:id/role`, delete with confirm →
  `DELETE /users/:id`; client-side redirect if `ft_role !== 'ADMIN'` (the
  real enforcement is the backend `RolesGuard`, this is just UX).
- **Course correction**: the plan said to add nav links to
  `frontend/src/app/tree/page.tsx`, but that file turned out to be stale
  dead code (an old duplicate of the dashboard, still named `Dashboard()`
  internally, with a broken `import { React } from 'react'`). The actual
  live "my trees" landing page is `frontend/src/app/dashboard/page.tsx` —
  added "Security (2FA)" and (role-gated) "Admin Panel" buttons there
  instead, next to the existing "Edit Profile" button.

This closes out every file in the approved plan
(`/Users/tnc/.claude/plans/twinkly-wishing-horizon.md`).

### Still outstanding before this is testable end-to-end
1. `cd backend && npx prisma db push && npx prisma generate` against the
   dev Supabase DB (schema has `role`/`UserRole`, 2FA fields, and the new
   `RecoveryCode` model — none of that exists in the actual DB yet).
2. Confirm `otplib`/`qrcode` are actually installed wherever the backend
   runs (user says npm install is done, but on this machine's checkout the
   host-side `backend/node_modules` still doesn't contain them as of
   2026-09-18 — likely fine if install happened inside the Docker container
   via its own anonymous `node_modules` volume, just flagging it as
   unverified from here).
3. Promote one user to `ADMIN` directly in the DB (self-promotion through
   the UI is intentionally blocked — same pattern as the existing
   `TreeService` self-role-change guard).
4. Then run through the Verification section in the plan file end-to-end:
   admin panel access control, role change, delete, 2FA enroll → logout →
   login-with-code, wrong code rejected, recovery code works once, disable
   2FA, and a clean browser console throughout.

### Known pre-existing issue noticed (not touched, out of scope)
- `frontend/src/app/tree/page.tsx` and `frontend/src/app/viewtree/pagess.tsx`
  look like dead/stale duplicates left in the tree — worth someone on the
  team confirming they're unused and deleting them at some point, since
  `tree/page.tsx` won't even compile cleanly (`import { React } from
  'react'`).

## 2026-09-18, ~20:00 — Session 3: proved it end-to-end against local Supabase

Goal: get a working proof on this machine *without* touching the shared dev
DB, since the "Still outstanding" list from Session 2 all required a real
database. User installed the local Supabase stack (`supabase start` —
Postgres, GoTrue auth, Studio etc. all in Docker) first, which unblocked this.

### 1. Pointed the app at local Supabase instead of the shared one
`.env` (gitignored, so this is a machine-local change only) was still using
the shared project's pooler URLs. Backed it up to `.env.remote-backup` and
swapped `DATABASE_URL` / `DIRECT_URL` / `SUPABASE_AUTH_URL` / the
`NEXT_PUBLIC_*` Supabase vars to `127.0.0.1:54322` / `127.0.0.1:54321` with
the local anon/publishable key (from `supabase status`). To go back to the
shared DB, just restore from the backup file.

### 2. The npm install saga (in case this bites someone else)
- **Attempt 1 (me, host)**: `npm install` in `backend/` failed with
  `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` fetching `@types/qrcode` from the npm
  registry.
- **Attempt 2 (user)**: ran `npm install` but from the **repo root**, not
  `backend/` — created a stray `/package.json` with just `react` in it and a
  root `node_modules`. Harmless but left in place (not cleaned up — flag if
  it's confusing later, it's not part of the app).
- **Root cause found**: it wasn't npm, package-specific, or a corporate MITM
  proxy (checked the System keychain for injected root certs — none found).
  It's that **Node's own bundled CA list doesn't trust the cert chain for
  `registry.npmjs.org` on this machine**, while `curl`/the browser do,
  because they use macOS's system trust store instead of Node's bundled one.
  Confirmed via `node -e "fetch(...)"` failing while `curl` to the same URL
  succeeded.
- **Fix**: `NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem` (macOS's own maintained CA
  bundle) — points Node at the same trust store curl already uses. With that
  set, `npm install` in `backend/` completed cleanly: `prisma`, `otplib`,
  `qrcode` all present in `node_modules`. If this happens again on another
  machine, this env var is the thing to try first, not disabling
  `strict-ssl` (that would remove real TLS protection, not fix the trust
  store).

### 3. Applied the schema locally
`npx prisma db push` from `backend/` needed `DATABASE_URL`/`DIRECT_URL`
exported manually — Prisma 7's `prisma.config.js` loads `.env` via
`dotenv/config` relative to **cwd**, so it doesn't pick up the root `.env`
the way the NestJS app does (`ConfigModule.forRoot({ envFilePath: '../.env' })`
in `app.module.ts`). Worked once the vars were exported by hand:
- `npx prisma db push` → synced in 130ms: `role`/`UserRole`, the 2FA columns,
  and `RecoveryCode` all now exist on the local DB.
- `npx prisma generate` → regenerated the client with the new fields/types.

### 4. Ran the real backend against it (Docker)
`main.ts` hardcodes `httpsOptions` reading `/app/certs/localhost-*.pem` —
that path only exists inside the container (docker-compose mounts
`./certs:/app/certs`), so running `nest start` directly on the host would've
crashed on a missing file. Built and ran it the normal way instead:
`docker compose build backend` then `docker compose up -d backend`.

**Gotcha**: inside a container, `127.0.0.1` means *the container itself*,
not the host machine — so the backend container couldn't reach local
Supabase at `127.0.0.1:54322`. Had to override `DATABASE_URL` /
`DIRECT_URL` / `SUPABASE_AUTH_URL` to use `host.docker.internal` instead of
`127.0.0.1` just for the `docker compose up` command (shell-exported vars
override `.env` for compose's substitution), while leaving the root `.env`
itself on `127.0.0.1` since that's correct for host-side tools like the
Prisma CLI. Backend came up clean, all routes mapped, zero errors in logs.

### 5. Smoke-tested every endpoint via curl (no browser needed for this pass)
Created a real user through local Supabase's auth API directly (signup →
access token → `POST /api/auth/login`), then drove the rest with curl +
`otplib` (in a `node -e` one-liner) to generate real TOTP codes:

- ✅ Signup → login hand-off creates a local `User` with `role: "USER"` by
  default.
- ✅ `POST /2fa/setup` → real secret + otpauth URL + QR data URL.
- ✅ `POST /2fa/enable` with a generated TOTP code → 8 recovery codes
  returned once.
- ✅ Next login now returns `{twoFactorRequired: true, challengeToken}`
  instead of a session.
- ✅ Wrong code on `/2fa/login-verify` → `401 Invalid 2FA code.`
- ✅ Correct TOTP code → real session issued.
- ✅ A recovery code works exactly once — second use with a fresh challenge
  → `401`.
- ✅ Promoted the test user to `ADMIN` via direct SQL (`UPDATE "User" SET
  role='ADMIN' ...` — self-promotion through the API is intentionally
  blocked, matching the plan).
- ✅ `GET /api/users` as admin → lists users correctly.
- ✅ `PATCH /users/:id/role` on a second test user → role changed.
- ✅ Admin tried to change **their own** role → `403 You cannot change your
  own role.`
- ✅ Non-admin hitting `GET /api/users` → `403`.
- ✅ `DELETE /users/:id` → user removed, confirmed gone from the list.
- ✅ `POST /2fa/disable` with a valid code → `{enabled: false}`, and its
  `RecoveryCode` rows were deleted (`SELECT count(*) FROM "RecoveryCode"` →
  `0`).
- ✅ Backend container logs stayed clean (no errors/warnings) through the
  whole session.

Backend logic is proven correct end-to-end. What this pass did **not**
cover: the actual browser UI (QR code rendering, the settings/admin pages,
console-error checking per the subject's requirement) — that still needs a
manual click-through.

### 6. OAuth — blocked on missing credentials, not code
Local `supabase/config.toml` has no `[auth.external.google]` /
`[auth.external.github]` blocks configured at all (only a disabled
`[auth.external.apple]` stub exists), and there are no Google/GitHub OAuth
client id/secret anywhere in this repo or `.env`. The frontend code
(`login/page.tsx`'s `signInWithOAuth`, `consent/page.tsx`'s callback +
2FA handling) is unchanged from before this session and was already
reviewed as correct in Session 2 — but it **can't be click-tested against
local Supabase** until Google/GitHub OAuth apps are registered with a
`http://127.0.0.1:54321/auth/v1/callback` redirect URI and their client
id/secret added to `supabase/config.toml`. This needs the user's own Google
Cloud / GitHub OAuth app credentials — not something to fabricate. Testing
OAuth + 2FA together (an OAuth login for a user who already has 2FA
enabled) is still an open item once that's set up.

### Current machine state (for next session)
- Local Supabase running (`supabase status` to check), backend Docker
  container running against it (`docker compose ps`).
- One leftover test user in the local DB: `tester1@example.com` /
  `TestPass123!`, role `ADMIN`, 2FA currently disabled — usable to click
  through `/admin/users` and `/settings/2fa` in the browser without
  re-signing-up.
- `.env` points at local Supabase; `.env.remote-backup` has the original
  shared-DB values if needed.
- Frontend hasn't been started/tested yet this session.

### Next steps
1. Start the frontend (`docker compose up -d frontend` or `npm run dev`)
   pointed at this same local Supabase instance and click through the plan's
   Verification checklist for real: QR scan with an authenticator app,
   `/admin/users` and `/settings/2fa` UI, browser console clean.
2. Register Google/GitHub OAuth apps (or reuse existing ones) with a local
   redirect URI to actually test the OAuth + 2FA combination.
3. Only once all of the above is solid locally, consider repeating
   `prisma db push` against the **shared** dev DB (restore
   `.env.remote-backup` values first) — deliberately not done this session.

## 2026-09-19 — Session 4: frontend up, browser testing started, new docs

### Started the frontend
`docker compose up -d --build frontend` — succeeded, `https://localhost:3000`
serves fine.

**Gotcha worth remembering**: that command also silently **recreated the
backend container**, which reset it back to the plain `.env` value
(`DATABASE_URL=...@127.0.0.1:54322/...`) instead of the `host.docker.internal`
override from Session 3. `127.0.0.1` inside a container means the container
itself, so backend lost its DB connection until I re-ran:
```
DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:54322/postgres" \
DIRECT_URL="postgresql://postgres:postgres@host.docker.internal:54322/postgres" \
SUPABASE_AUTH_URL="http://host.docker.internal:54321" \
docker compose up -d backend
```
Confirmed via `docker exec transpeed-backend-1` testing raw TCP connects:
`host.docker.internal:54322` connects, `127.0.0.1:54322` gets
`ECONNREFUSED`. **Any `docker compose up --build <anything>` risks silently
recreating backend with the wrong DB URL** — if login suddenly 500s after
touching Docker, check `docker exec transpeed-backend-1 sh -c 'echo
$DATABASE_URL'` first before anything else.

### Browser login — Firefox mixed-content block (user-side)
User hit "NetworkError when attempting to fetch resource" logging in via
`tester1@example.com` in Firefox. Root cause: `login/page.tsx` calls
`supabase.auth.signInWithPassword` **directly from the browser** against
`NEXT_PUBLIC_SUPABASE_URL` — locally that's plain `http://127.0.0.1:54321`
(local Supabase has no TLS), while the frontend itself is served over
`https://localhost:3000`. Firefox/Chrome both block an HTTPS page from
silently fetching an HTTP resource ("mixed content"). This never came up
against the shared dev Supabase project because that one is `https://`.

Not a code bug — a local-dev-only environment mismatch. Fix used: Chrome
allows it via a per-site "Insecure content" permission; user confirmed
**login now works in Chrome**. Firefox's equivalent (padlock icon → disable
protection) is only per-session, user is fine using Chrome for now instead
of chasing a permanent Firefox fix.

### New docs written (all in `tching_notes/`, not yet shared with the team)
- **`backend.md`** / **`frontend.md`** — walkthrough of every
  module/feature in both codebases, organized by feature with who actually
  built it (from `git log --no-merges --numstat` per path, not just the
  README's aspirational task-assignment table — the two don't fully agree,
  e.g. the "trees as orgs" work assigned to John in the README was mostly
  built by Moiralah + Leong Kin Chan in practice). Flags two things worth
  the team's attention: `viewtree/page.tsx` and `canvas/[id]/page.tsx` look
  like two independent, unconnected implementations of the same tree-diagram
  feature, and `app/tree/page.tsx` is confirmed dead/non-compiling code.
- **`test_checklist.md`** — whole-app manual test checklist grouped by
  feature, checkboxes + a Notes line per item for the user to fill in while
  testing. Items already curl-verified in Session 3 are pre-checked and
  labeled `(backend verified)` since that's not the same as a real
  browser click-through.
- **`vision.md`** — product vision/use-case/shipping-path notes, written as
  a real product (not just the eval) per the user's request: the problem
  (family history stuck with one gatekeeper relative), who it's for,
  what differentiates it from Geni/Ancestry (the collaboration model),
  and a phased path from current state → dogfooding with real families →
  the features that actually block adoption → production infra → growth
  loop. Flags an open gap: no first-class "mark as deceased" concept in
  the data model yet, which matters more for this use case than typical
  CRUD polish.

### Current machine state (for next session)
- Both `transpeed-backend-1` and `transpeed-frontend-1` running, backend
  correctly pointed at local Supabase via `host.docker.internal` (see
  gotcha above — re-check this if anything's been rebuilt since).
- User is mid-way through manually testing 2FA in Chrome using
  `test_checklist.md` section 2 — not yet reported back with results.

### Next steps
1. Get results back from the user's manual 2FA click-through and update
   `test_checklist.md` accordingly (this is on the user, not something to
   pre-fill from here).
2. Same OAuth/shared-DB items as Session 3's next steps — still open.
