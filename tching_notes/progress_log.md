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

### Not started yet (per the approved plan)

- `frontend/src/components/twoFactorPrompt.tsx` (shared inline TOTP/recovery
  code entry form).
- Wiring `login/page.tsx`, `consent/page.tsx`, `signup/page.tsx` to use
  `lib/auth.ts`, store `ft_role`, and handle the `twoFactorRequired` branch.
- `frontend/src/app/settings/2fa/page.tsx` (enable/disable 2FA UI, QR code
  display, recovery codes reveal).
- `frontend/src/app/admin/users/page.tsx` (user list, role dropdown, delete,
  client-side admin gate).
- Small nav links from `frontend/src/app/tree/page.tsx` to the admin panel
  and 2FA settings.

### Next steps when resuming
1. Pick up frontend work in the order listed above (`twoFactorPrompt`
   component next, since login/consent pages depend on it).
2. Remind the user to run, before testing anything:
   - `cd backend && npx prisma db push && npx prisma generate`
   - a backend container rebuild so `otplib`/`qrcode` actually get installed.
3. Follow the Verification section in the plan file to test end-to-end
   (promote a user to ADMIN directly in the DB first, since self-promotion
   through the UI is intentionally blocked).
