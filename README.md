# 👨‍👩‍👧‍👦 Family Tree – ft_transcendence

## 🚀 How to run

1. **Clone the repository** and run `make` to start the environment.
2. **Approve backend cert** open new tab 'https://localhost:4000
3. **Approve frontend cert** open new tab 'https://localhost:3000


## 🧪 Running Supabase Locally

For testing/schema changes without touching the shared dev Supabase
project. All of this is optional — the shared `.env` values still work
fine if you don't need this.

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
SUPABASE_SERVICE_ROLE_KEY=<PUBLISHABLE_KEY from `supabase status`>
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY from `supabase status`>
```

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

### 5. Google/GitHub OAuth locally (optional)
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

## 📍 Summary

We are building a **family tree & collaboration platform** using **Next.js (frontend)**, **NestJS (backend)**, **Prisma (ORM)**, **Supabase (auth)**, **PostgreSQL**, and **Tailwind CSS**.

Website inspiration: https://www.mysimplefamilytree.com/ & https://www.geni.com

The current codebase already provides:

- User authentication with **Supabase** (email/password + Google/GitHub OAuth)
- JWT token handling
- Basic **tree** and **profile** management
- Role‑based permissions within trees (ADMIN, MODERATOR, MEMBER, VIEWER)
- Global user roles (ADMIN/MODERATOR/USER) with an admin panel to manage them
- Two‑factor authentication (TOTP + recovery codes)
- A custom design system with a colour palette, typography, and reusable components (10+ components)
- Containerised deployment with Docker / docker‑compose

All services run with a single `make` command.

---

## 🧩 Modules – Progress & To‑Do

We have chosen the following modules.
**Completed** ✅ are already functional; **In‑progress** 🔄 need finishing; **Not started** ❌ need implementation.

| Module | Type | Points | Status | Notes |
|--------|------|--------|--------|-------|
| Use a frontend framework (React/Next.js) | Minor | 1 | ✅ Done | Next.js 14 |
| Use a backend framework (NestJS) | Minor | 1 | ✅ Done | NestJS 10 |
| Use an ORM (Prisma) | Minor | 1 | ✅ Done | Prisma with Supabase Postgres |
| Custom design system with ≥10 reusable components | Minor | 1 | ✅ Done | Components: Button, Navbar, Footer, Banner, FeatureCard, FeaturesGrid, SectionHeader, Typography, Icon, SkipLink |
| **Remote authentication with OAuth 2.0 (Google, GitHub)** | Minor | 1 | 🔄 Partial | Supabase OAuth integrated; fixed a redirect bug (was pointing at a nonexistent route) and verified Google login end-to-end against a local Supabase instance; still needs Google/GitHub enabled in the shared Supabase project's dashboard |
| **Standard user management and authentication** | Major | 2 | 🔄 Partial | Login/signup working, but still need: avatar upload, friends system, online status, profile page |
| **Advanced permissions system** (global roles) | Major | 2 | ✅ Done | Global `role` on `User` (ADMIN/MODERATOR/USER), `RolesGuard`, `/api/users` CRUD (list/change role/delete, self-demotion blocked), admin panel at `/admin/users` |
| **Organization system** (trees as orgs) | Major | 2 | 🔄 Partial | Trees exist with members and roles; need to implement: edit/delete tree, add/remove members via UI, invitation system |
| **Real‑time features** (Supabase Realtime) | Major | 2 | ❌ Not started | Chat, real‑time updates, notifications |
| **Public API** with secured API key, rate limiting, docs, ≥5 endpoints | Major | 2 | ❌ Not started | Need to expose a public API for e.g. public trees or profiles |
| **Complete notification system** for CRUD actions | Minor | 1 | ❌ Not started | Should be integrated with Supabase Realtime |
| **Real‑time collaborative features** (shared workspaces, live editing) | Minor | 1 | ❌ Not started | Could be part of Supabase Realtimereal‑time features |
| **Advanced search** with filters, sorting, pagination | Minor | 1 | ❌ Not started | For trees and profiles |
| **Complete accessibility compliance** (WCAG 2.1 AA) | Major | 2 | ❌ Not started | Need audit and fixes (keyboard nav, screen reader, ARIA) |
| **Support for additional browsers** (Firefox, Safari, Edge) | Minor | 1 | ❌ Not started | Test and document cross‑browser compatibility |
| **2FA (Two‑Factor Authentication)** | Minor | 1 | ✅ Done | Custom TOTP (not Supabase native MFA) via `otplib`/`qrcode`, 8 bcrypt-hashed recovery codes, enroll/verify/disable flow at `/settings/2fa`, login challenge on `/2fa/login-verify` |
| **User activity analytics dashboard** | Minor | 1 | ❌ Not started | Show user actions, logs, insights |

### Total possible points
Completed so far: 1+1+1+1+2+1 = **7 points**
Remaining (if we implement everything) = 1+2+2+2+2+1+1+1+2+1+1 = **16 points**
Minimum required: **14 points** – we have more than enough, so we can choose which to prioritise.

---

## 📋 Task Breakdown Plan (4 People)

Task breakdown by person. Each task includes a rough effort estimate.

### 👤 Maira – Real‑time & Notifications
- **Real‑time features (Supabase Realtime)** – 2 pts
  - Set up  gateway in NestJS
  - Implement chat between users (direct and tree‑based)
  - Handle connection/disconnection, broadcast events
- **Notification system** – 1 pt
  - Create notification model (Prisma)
  - Push notifications on create/update/delete actions
  - Display notifications in frontend (with real‑time updates)
- **Real‑time collaborative features** – 1 pt


### 👤 John – User Management
- **Complete user management** – 2 pts
  - Profile page (view/edit)
  - Avatar upload (file upload)
  - Friends system (add/remove, list)
  - Online status (using Supabase Realtime presence)
- **Organization system (trees as orgs)** – 2 pts
  - Edit/delete tree (admin only)
  - Add/remove members via UI (admin only)
  - Invitation system (already has model, need frontend)
- **Accessibility (WCAG 2.1 AA)** – 2 pts
  - Audit with Lighthouse/axe
  - Fix keyboard navigation, ARIA labels, semantic HTML
  - Ensure screen reader compatibility
- **Additional browsers** – 1 pt
  - Test on Firefox, Safari (macOS), Edge
  - Fix layout/CSS issues
  - Document differences


### 👤 Person C – Public API & Search
- **Public API** – 2 pts
  - Design public endpoints (e.g., `/api/public/trees`, `/api/public/profiles`)
  - Secure with API key (header)
  - Add rate limiting (e.g., using `@nestjs/throttler`)
  - Document using OpenAPI/Swagger
- **Advanced search** – 1 pt
  - Implement search endpoint with filters (name, date, tree)
  - Add sorting and pagination (Prisma `skip`/`take`)
  - Frontend search UI


### 👤 Person D – Accessibility, Permissions & Browsers
- **Advanced permissions (global roles)** – 2 pts ✅ Done
  - Add `role` field to `User` (admin, user, moderator)
  - Implement user management UI (list, edit, delete, change roles)
  - Restrict admin panel to admins
- **2FA** – 1 pt ✅ Done
  - TOTP setup, verification, recovery codes

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
  role management, links to Security (2FA) and (role-gated) Admin Panel
- `/app/consent` – OAuth callback handler, also handles the 2FA challenge
  for OAuth logins
- `/app/settings/2fa` – enable/disable 2FA, QR enrollment, recovery codes
- `/app/admin/users` – admin-only user list, role changes, delete
- Design system: components (`Button`, `Navbar`, `Footer`, `Banner`, `FeatureCard`, `FeaturesGrid`, `SectionHeader`, `Typography`, `Icon`, `SkipLink`)

### Backend (NestJS)
- `src/api/auth` – Supabase OAuth + JWT, global `RolesGuard`
- `src/api/auth/two-factor` – TOTP setup/enable/disable/login-verify
- `src/api/users` – admin-only user list/role-change/delete
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


