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
