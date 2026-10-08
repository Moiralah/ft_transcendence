# 👨‍👩‍👧‍👦 Family Tree – ft_transcendence

## 🚀 How to run

1. **Clone the repository** and copy `.env.example` to `.env`. Fill in only
   the non-secret settings (ports, URLs); leave the secret lines empty, the
   secrets come from Vault.
2. **Turn on WireGuard** (ask Tiara for your key and your Vault login, one time).
3. **`make up`**: asks your Vault password (once a day), loads the dev secrets
   into memory and starts the app on a local Supabase (needs the
   [Supabase CLI](https://supabase.com/docs/guides/cli); it starts it for you).
   No WireGuard or Vault right now? `make up-env` is the old way, with every
   value filled in `.env`.
4. **Approve backend cert** open new tab 'https://localhost:4000
5. **Approve frontend cert** open new tab 'https://localhost:3000

How Vault, `make up`, `make deploy` and `make unseal` fit together:
[diagram/vault-remote-env.html](diagram/vault-remote-env.html) and
[vault/README.md](vault/README.md).

Running the security stack (`make security`, see below) instead? Ports `3000`
and `4000` are not published there. Approve `https://localhost:9443` (API) and
`https://localhost:8443` (the app) instead, and open the app on `:8443`.


## 🧪 Running Supabase Locally

For testing/schema changes without touching the shared dev Supabase
project. All of this is optional — the shared `.env` values still work
fine if you don't need this.

**Shortcut:** `make local` (plain stack) or `make local-security` (WAF+Vault
stack) run `supabase start` if it isn't already, read its keys automatically,
and bring the stack up pointed at it — handles the `host.docker.internal`
override and key copy-pasting below for you. The steps below are what that
script is actually doing, useful if something goes wrong or you want to do
it by hand.

### 1. Start it
Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and
Docker running. The `supabase/` folder (config + migrations) is already
in this repo, so you don't need to run `supabase init`.

```bash
supabase start
```

First run pulls a handful of Docker images, so it's slow the first time.
`supabase status` prints the local URLs/keys any time after that.

### 2. Point the app at it
Local Supabase's Postgres, Auth API, and Studio all run on fixed local
ports. Back up your current `.env` first, then swap these values (keep
everything else the same):

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SUPABASE_AUTH_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase status -o env`>
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY from `supabase status`>
```
(`SUPABASE_SERVICE_ROLE_KEY` must be the service-role/secret key, not the
publishable one: the publishable key is enough to sign people in, but not for
admin actions such as removing a deleted user's Supabase login.)

### 3. Push the schema
```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
npx prisma db push && npx prisma generate
```
(The env vars need to be exported like this even though they're already in
`.env` — Prisma's config only auto-loads a `.env` from the current
directory, not the repo root, when run from `backend/`.)

### 4. ⚠️ If running the backend via Docker: use `host.docker.internal`, not `127.0.0.1`
Inside a container, `127.0.0.1` means the container itself, not your host
machine — so the backend container can't reach local Supabase at
`127.0.0.1:54322`/`:54321`. Start it with these overridden instead (your
`.env` file itself stays on `127.0.0.1`, which is correct for host-side
tools like the Prisma CLI above):

```bash
DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:54322/postgres" \
DIRECT_URL="postgresql://postgres:postgres@host.docker.internal:54322/postgres" \
SUPABASE_AUTH_URL="http://host.docker.internal:54321" \
docker compose up -d backend
```
**Any later `docker compose up --build` (even for a different service like
`frontend`) can silently recreate the backend container and reset it back
to the plain `.env` values.** If login suddenly breaks after touching
Docker, check `docker exec transpeed-backend-1 sh -c 'echo $DATABASE_URL
$SUPABASE_AUTH_URL'` before anything else — both need
`host.docker.internal`, not `127.0.0.1`.

### 5. Google OAuth locally (optional)
Local Supabase has no OAuth providers configured out of the box. To test
Google sign-in locally without touching the shared project:
1. In Google Cloud Console, add a **second** Authorized redirect URI to
   your existing OAuth client (don't need a new one):
   `http://127.0.0.1:54321/auth/v1/callback` — note **`http`, not
   `https`** (local Supabase has no TLS).
2. Create `supabase/.env` (gitignored) with:
   ```env
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-client-secret
   ```
3. Add to `supabase/config.toml`:
   ```toml
   [auth.external.google]
   enabled = true
   client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
   secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
   ```
4. `supabase stop && supabase start`, then verify with:
   ```bash
   curl -s http://127.0.0.1:54321/auth/v1/settings | grep google
   ```

### Going back to the shared DB
Restore your original `.env` values and you're back on the shared project
— nothing about local Supabase touches it.

---

## 🛡️ Cybersecurity module (WAF + Vault)

ModSecurity + the OWASP Core Rule Set, fronting both `frontend` and
`backend` — kept in a **separate** compose file
(`docker-compose-security.yml`) so the rest of the team's `make up` /
`docker compose up` doesn't need to pull that image or care about this
module at all. See `diagram/architecture.html` for the full request-flow
diagram (open it directly in a browser, no server needed).

```bash
make security          # brings up the WAF alongside the base stack
make security-down     # tears it down
```

In this stack the WAF is the **only** way in: `:3000` and `:4000` are not
published to your machine (`ports: !reset []` in
`docker-compose-security.yml`, which needs Docker Compose 2.24 or newer). The
WAFs still reach the frontend and backend over the Docker network. The plain
`make up` stack, which has no WAF, still publishes them.
- `https://localhost:8443` → frontend, inspected — **open the app here**
- `https://localhost:9443` → backend API, inspected (the app's browser calls go here)

To see a request that the WAF blocks reach the app unfiltered, run the plain
`make up` stack and send it to `:4000`.

**Two gotchas, both already hit once:**
1. Same as the local-Supabase section above — any `docker compose up`
   touching `backend` (including just bringing the WAF up, via
   `depends_on`) can silently reset `DATABASE_URL`/`SUPABASE_AUTH_URL`
   back to `127.0.0.1`. Check `docker exec transpeed-backend-1 sh -c
   'echo $DATABASE_URL'` after any compose command.
2. **New one**: the WAF's nginx resolves `backend`'s IP once at its own
   startup. If `backend` gets recreated afterward (a new container gets a
   new IP), the WAF starts returning `502` even though everything looks
   healthy — nginx is still pointing at the old, dead IP. Fix: `docker
   restart transpeed-waf-backend-1 transpeed-waf-frontend-1` any time
   `backend`/`frontend` get recreated while the WAF is up.

### Vault (secrets management)

`make security` also starts a HashiCorp Vault (dev mode) and runs
`scripts/vault-init.sh`, which:
1. Writes `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
   `DATABASE_URL`/`DIRECT_URL`, `SUPABASE_AUTH_URL` into Vault's KV v2
   store at `secret/data/family-tree/backend`.
2. Sets up **AppRole** auth with a policy scoped to read-only on exactly
   that one path — not the root token. (`vault-init.sh` itself still uses
   the root token, since something has to bootstrap the AppRole in the
   first place; the backend never sees it.)
3. Starts `backend` with fresh AppRole credentials
   (`VAULT_ROLE_ID`/`VAULT_SECRET_ID`).

`backend/src/vault/load-secrets.ts` fetches these at boot (before
anything else runs) and injects them into `process.env`, so every
existing `ConfigService.get()`/`process.env` read elsewhere in the app is
unchanged — it doesn't know or care whether a value came from Vault or
`.env`. If `VAULT_ADDR` isn't set (i.e. you're running `make up` without
`make security`), it's a no-op and everything falls back to `.env`
exactly like before Vault existed.

**Why this resets every time**: Vault here runs in **dev mode** — no
storage backend, everything in-memory, auto-unsealed with a hardcoded
root token. That's why `vault-init.sh` isn't a one-time setup script, it
re-bootstraps the secret + AppRole on every `make security`, because the
previous run's data is gone the moment the `vault` container restarts.
This is explicitly not production-ready, same caveat the subject itself
calls out — a real deployment needs a persistent storage backend (file or
Raft), TLS, and proper unsealing instead of a baked-in root token.

**To verify it yourself**: `docker logs transpeed-backend-1 | grep vault`
should show `[vault] loaded 5 secrets from secret/data/family-tree/backend`.
If it instead says "VAULT_ADDR/VAULT_ROLE_ID/VAULT_SECRET_ID not set",
`backend` was started without going through `make security`/`vault-init.sh`.

### Vault on solsys: secrets kept remotely (built, not switched on yet)

The dev-mode setup above is what production runs today. Its replacement is
built and was rehearsed on 2026-10-08; it goes live on solsys on switch day
([vault/README.md](vault/README.md)):

- **One server-mode Vault on solsys**: encrypted on disk, keeps its data
  across restarts, sealed after every restart until 2 of 5 unseal shares are
  entered (`make unseal`, from any share holder's laptop over WireGuard).
- **Two paths**: `secret/family-tree/prod`, read only by the production
  backend's AppRole, and `secret/family-tree/dev`, read by everyone's
  `make up`. Each person has their own Vault login; there is no root token.
  Every request goes to the audit log.
- **`make deploy`** (laptop with SSH to solsys) pulls `branchsaurus` there and
  runs `make prod`, which uses this Vault once the backend's login file
  (`vault/backend-approle.env`) exists.

---

## 📍 Summary

We are building a **family tree & collaboration platform** using **Next.js (frontend)**, **NestJS (backend)**, **Prisma (ORM)**, **Supabase (auth)**, **PostgreSQL**, and **Tailwind CSS**.

Website inspiration: https://www.mysimplefamilytree.com/ & https://www.geni.com

The current codebase already provides:

- User authentication with **Supabase** (email/password + Google OAuth)
- JWT token handling
- Basic **tree** and **profile** management
- Role‑based permissions within trees (ADMIN, MODERATOR, MEMBER, JOINER, HOLDER)
- Global user roles (ADMIN/MODERATOR/USER) with an admin panel to manage them
- Two‑factor authentication (TOTP + recovery codes)
- A custom design system with a colour palette, typography, and reusable components (10+ components)
- Containerised deployment with Docker / docker‑compose

All services run with a single `make` command.

---

## 🧩 Modules – Progress & To‑Do

We have chosen the following modules.
**Completed** ✅ are already functional; **In‑progress** 🔄 need finishing; **Not started** ❌ need implementation.

| Module | Owner | Type | Points | Status | Notes |
|--------|-------|------|--------|--------|-------|
| Use a frontend framework (React/Next.js) | Jon | Minor | 1 | ✅ Done | Next.js 14 |
| Use a backend framework (NestJS) | Moira | Minor | 1 | ✅ Done | NestJS 10 |
| Use an ORM (Prisma) | Moira | Minor | 1 | ✅ Done | Prisma with Supabase Postgres |
| Custom design system with ≥10 reusable components | Jon | Minor | 1 | ✅ Done | Components: Button, Navbar, Footer, Banner, FeatureCard, FeaturesGrid, SectionHeader, Typography, Icon, SkipLink |
| **Remote authentication with OAuth 2.0 (Google)** | Tiara | Minor | 1 | ✅ Done | Supabase OAuth integrated; fixed a redirect bug (was pointing at a nonexistent route); verified Google login end-to-end against production (`ft.natscho.my`) — real Supabase project, real domain, not just local. GitHub was also built and tested working, then deliberately dropped — didn't fit the app's theme, Google alone covers the module requirement |
| **Standard user management and authentication** | Moira & Jon (profile, avatar, profile page); Yiwei (friends, online status) | Major | 2 | 🔄 Partial | Login/signup working, but still need: avatar upload, friends system, online status, profile page |
| **Advanced permissions system** (global roles) | Tiara | Major | 2 | ✅ Done | Global `role` on `User` (ADMIN/MODERATOR/USER), `RolesGuard`, `/api/users` CRUD (list/change role/delete, self-demotion blocked), admin panel at `/admin/users`; moderators can suspend/unsuspend users (suspension blocks login and ends active sessions immediately) |
| **Organization system** (trees as orgs) | Moira | Major | 2 | 🔄 Partial | Trees exist with members and roles; need to implement: edit/delete tree, add/remove members via UI, invitation system |
| **Real‑time features** (Supabase Realtime) | Moira | Major | 2 | ❌ Not started | Chat, real‑time updates, notifications |
| **Public API** with secured API key, rate limiting, docs, ≥5 endpoints | Yiwei | Major | 2 | ❌ Not started | Need to expose a public API for e.g. public trees or profiles |
| **Complete notification system** for CRUD actions | Moira & Tiara | Minor | 1 | ❌ Not started | Should be integrated with Supabase Realtime |
| **Real‑time collaborative features** (shared workspaces, live editing) | Moira & Jon | Minor | 1 | ❌ Not started | Could be part of Supabase Realtimereal‑time features |
| **Advanced search** with filters, sorting, pagination | Yiwei | Minor | 1 | ❌ Not started | For trees and profiles |
| **Complete accessibility compliance** (WCAG 2.1 AA) | Jon | Major | 2 | ❌ Not started | Need audit and fixes (keyboard nav, screen reader, ARIA) |
| **Support for additional browsers** (Firefox, Safari, Edge) | Jon | Minor | 1 | ❌ Not started | Test and document cross‑browser compatibility |
| **2FA (Two‑Factor Authentication)** | Tiara | Minor | 1 | ✅ Done | Custom TOTP (not Supabase native MFA) via `otplib`/`qrcode`, 8 bcrypt-hashed recovery codes, enroll/verify/disable flow at `/settings/2fa`, login challenge on `/2fa/login-verify` |
| **Cybersecurity** (WAF + secrets manager) | Tiara | Major | 2 | ✅ Done | ModSecurity + OWASP CRS fronting both frontend and backend, proven blocking real SQLi/XSS with a `403`. HashiCorp Vault (dev mode in production today; server mode with 5 unseal shares, per-person logins and an audit log built and rehearsed, see `vault/README.md`) storing backend secrets, AppRole auth (not root token), backend fetches at boot via `backend/src/vault/load-secrets.ts`. `docker-compose-security.yml`, `make security`. Direct `:3000`/`:4000` access is locked down in this stack (`ports: !reset []` on both) — the WAF is the only way in |
| **Server‑Side Rendering (SSR)** for performance and SEO | *TBA* | Minor | 1 | ❌ Not started | Not assigned yet. Public pages are currently pre-rendered at build time (static), and all user data loads in the browser; claiming the module needs per-page SEO metadata and at least one page rendered on the server per request with data (e.g. a public tree page) |
| **User activity analytics dashboard** | *Unassigned* | Minor | 1 | ❌ Not started | Show user actions, logs, insights |

### Points
Assigned modules: 7 Majors (14 pts) + 10 Minors (10 pts) = **24 points**, 10 above the required **14**,
which leaves a margin in case a module isn't validated at evaluation. Not assigned yet: SSR (Minor, TBA)
and the user activity analytics dashboard (Minor). Each module's current status is in the table above.

---

## 📋 Roles and module ownership

### Team roles

| Role | Who | Responsibilities |
|------|-----|------------------|
| **Product Owner (PO)** | Moira | Product vision, feature priorities and backlog; validates completed work; speaks for the team to evaluators and peers |
| **Project Manager (PM) / Scrum Master** | Tiara | Organises meetings and planning, tracks progress and deadlines, keeps communication going, manages risks and blockers |
| **Technical Lead / Architect** | Moira & Jon | Technical architecture and stack decisions, code quality and best practices, reviews of critical changes |
| **Developers** | Moira, Jon, Yiwei, Tiara | Build their assigned modules (below), review each other's code, test and document their work |

### Module ownership

Who owns which module (shared modules list every owner). Effort per module in points.

### 👤 Moira
- **Backend framework (NestJS)** – Minor, 1 pt
- **ORM (Prisma)** – Minor, 1 pt
- **Organization system (trees as orgs)** – Major, 2 pts
  - Create, edit and delete trees; add and remove members; actions per member role
- **Real‑time features** – Major, 2 pts
  - Real-time updates across clients, connection/disconnection handling, efficient broadcasting
- **Notification system** for create/update/delete actions – Minor, 1 pt *(with Tiara)*
- **Real‑time collaborative features** – Minor, 1 pt *(with Jon)*
- **Standard user management** – Major, 2 pts *(with Jon; Yiwei does friends and online status)*
  - Update profile information, avatar upload with a default, profile page

### 👤 Jon
- **Frontend framework (Next.js)** – Minor, 1 pt
- **Custom design system** (≥10 reusable components) – Minor, 1 pt
- **Accessibility (WCAG 2.1 AA)** – Major, 2 pts
  - Screen reader support, keyboard navigation, assistive technologies
- **Support for additional browsers** – Minor, 1 pt
- **Real‑time collaborative features** – Minor *(with Moira)*
- **Standard user management** – Major *(with Moira)*: profile update, avatar, profile page

### 👤 Yiwei
- **Public API** – Major, 2 pts
  - Secured API key, rate limiting, documentation, at least 5 endpoints
- **Advanced search** with filters, sorting and pagination – Minor, 1 pt
- **Standard user management** – Major *(friends and online status part)*

### 👤 Tiara
- **Remote authentication with OAuth 2.0 (Google)** – Minor, 1 pt ✅ Done
- **Advanced permissions (global roles)** – Major, 2 pts ✅ Done
  - Global `role` on `User` (admin, moderator, user), enforced by `RolesGuard`
  - User management UI: list, change roles, suspend, delete; moderators get a reduced view
- **2FA** – Minor, 1 pt ✅ Done
  - TOTP setup, verification, recovery codes
- **Cybersecurity: WAF/ModSecurity + HashiCorp Vault** – Major, 2 pts ✅ Done
- **Notification system** – Minor *(with Moira)*

### Not assigned yet
- **Server‑Side Rendering (SSR)** – Minor, 1 pt – *TBA*
- **User activity analytics dashboard** – Minor, 1 pt

---

## 🗃️ Codebase Overview (What’s Already Done)

### Frontend (Next.js)
- `/app/page.tsx` – landing page with design system components
- `/app/login` – login with email/password and OAuth buttons; renders a 2FA
  code prompt inline when a login requires it
- `/app/signup` – signup with validation
- `/app/tree` – list of user’s trees, create/join/search modals ⚠️ stale
  dead code, not the live landing page (see `/app/dashboard`)
- `/app/dashboard` – the actual "my trees" landing page: members, profiles,
  role management, links to Security & Password and (role-gated) Admin Panel
- `/app/consent` – OAuth callback handler, also handles the 2FA challenge
  for OAuth logins
- `/app/settings/2fa` – enable/disable 2FA, QR enrollment, recovery codes
- `/app/admin/users` – admin-only user list, role changes, delete
- Design system: components (`Button`, `Navbar`, `Footer`, `Banner`, `FeatureCard`, `FeaturesGrid`, `SectionHeader`, `Typography`, `Icon`, `SkipLink`)

### Backend (NestJS)
- `src/api/auth` – Supabase OAuth + JWT, global `RolesGuard`
- `src/api/auth/two-factor` – TOTP setup/enable/disable/login-verify
- `src/api/users` – user list (admin and moderator), role change and delete (admin only), suspend/unsuspend (admin and moderator)
- `src/api/profile` – CRUD for persons (renamed `Profile`)
- `src/api/tree` – tree creation, joining, search, members, roles
- `src/prisma` – Prisma client with `PrismaPg` driver adapter
- `src/supabase` – Supabase client module
- Database schema (Prisma) with `User` (incl. global `role`, 2FA fields),
  `RecoveryCode`, `Tree`, `TreeMember`, `Invitation`, `Profile`,
  `ProfileSpouse`, `Event`, `AuditLog`
- Global prefix `/api` – routes are `/api/auth/login`, `/api/trees/...`, etc.

### Deployment
- Docker & docker‑compose with development volumes
- `make` starts all services
- Backend uses HTTPS with self‑signed certificate (mounted from `./certs`)
- Frontend uses `next dev --experimental-https`


