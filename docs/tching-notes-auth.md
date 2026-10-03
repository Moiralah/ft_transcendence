# Public API (Some cascading work)

This note covers what Yiwei can rely on from the modules I've build (permissions, 2FA, OAuth, and cybersecurity), which should leave alone, what to watch out for, and a suggested order of work.

## How authentication works today

- The API uses a JWT. The backend issues it after a Supabase login, and it's stored in the browser's `sessionStorage`.
- There is **no global guard**. `backend/src/main.ts` only sets the `/api` prefix and a global `ValidationPipe` (`whitelist: true, transform: true`).
- Each route opts in with `@UseGuards(JwtAuthGuard)`. `JwtAuthGuard` is in `backend/src/api/auth/jwt-auth.guard.ts`, and the token check is in `jwt.strategy.ts`.

A route without `@UseGuards` is public by default. Public routes can leave out `JwtAuthGuard` entirely, and you should add a separate API-key guard to them.

## What can use on existing modules

Lemme know if you making changes on these.

**JWT auth (`jwt-auth.guard.ts`, `jwt.strategy.ts`).** Friends and search use this. Use `@UseGuards(JwtAuthGuard)` and read `req.user.profileId`. A suspended user is rejected on every request automatically, so nothing extra is needed for that.

**Roles (`roles.guard.ts`, `roles.decorator.ts`, `users.controller.ts`).** Per-route `@Roles(...)` is already in use. If the public API needs admin-only actions, such as creating or revoking API keys, use `@Roles('ADMIN')` the same way. Don't add a second roles system.

**Secrets (`backend/src/vault/load-secrets.ts`, `scripts/vault-init.sh`).** Anything secret for the API (a pepper, a signing key) goes into the secrets `vault-init.sh` writes, and is read through `load-secrets.ts`. Don't change `docker-compose-security.yml` to add it; ask Tiara.

**WAF.** New routes go through the WAF automatically.

**Login, consent, and 2FA pages (`login/`, `consent/`, `settings/2fa/`, `twoFactorPrompt.tsx`).** If the WCAG work changes them, coordinate with Tiara so you don't overwrite each other.

**Tree membership and visibility (Moira's code).** `getTreeById` and `getTreeMember` in `tree.service.ts` reject non-members with a 403. Follow the same pattern for anything that exposes tree data. `Tree.isPublic` is in the schema, but nothing enforces it yet.
