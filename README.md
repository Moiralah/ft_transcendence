*This project has been created as part of the 42 curriculum by tching, lechan, huidris, yiwei.*

# 👨‍👩‍👧‍👦 Family Tree – ft_transcendence

## 📍 Description

A **private, shared family tree** for one family at a time. Every family has
one person who keeps the family history: in their head, in group-chat photos,
or in a chart drawn years ago. When they stop, it stops. Big sites
(Ancestry, MyHeritage) are paid research tools, and Geni is one huge public
tree. We wanted a tree per family that the whole family edits together: you
**join with a code, claim the person who is you, and add your own branch**.

It is a full web application: Next.js frontend, NestJS backend, PostgreSQL
(hosted by Supabase) through Prisma, all in Docker and started with one
command. It runs live at **https://ft.natscho.my**.

Website inspiration: https://www.mysimplefamilytree.com/ & https://www.geni.com

---

## 🚀 Instructions

**Prerequisites:** Docker with Docker Compose **2.24 or newer**, `make`,
`openssl` (for the local self-signed certificates). Node is not needed on the
host.

1. **Clone the repository**, copy `.env.example` to `.env` and fill it in (the
   comments in that file say where each value comes from), then run `make`.
   `make` (same as `make up`) starts everything: the app, both WAFs and Vault.
2. **Approve the backend certificate:** open https://localhost:9443 in a new tab
   and accept the self-signed certificate. The page then shows
   `{"message":"Cannot GET /","error":"Not Found","statusCode":404}`: that's
   expected (the API has no page at `/`) and means the certificate is accepted.
3. **Approve the frontend certificate:** open https://localhost:8443, accept it,
   and use the app there.

   If Chrome shows no "Proceed to localhost" link ("the website uses HSTS"), it
   remembered HSTS for localhost from an earlier version: open
   `chrome://net-internals/#hsts`, delete the domain `localhost`, and reload.

`make down` stops everything. Other targets: `make logs`, `make ps`,
`make build`, `make backend` / `make frontend` (rebuild one side),
`make local` (run against a local Supabase, below).

**Team members with a Vault login** leave the secret lines in `.env` empty and
set `VAULT_USER` once to your intra login (e.g. `export VAULT_USER=huidris` in
`~/.zshrc`). `make up`
then opens your own SSH tunnel to the Vault on solsys (the Vault server,
HashiCorp Vault), asks your Vault password (once a day), and keeps the dev
secrets in memory only. It runs on the
**production Supabase** (the real users' data: test on your own test trees and
accounts), with its own JWT secret and no email password. One-time setup (your SSH
key and Vault login, from Tiara): [vault/README.md](vault/README.md); how it fits
together: [diagram/vault-remote-env.html](diagram/vault-remote-env.html).

**Production** runs on solsys (the Vault server, HashiCorp Vault), a home
server, behind a GCP machine that holds the public IP: browser → GCP nginx
proxy (Let's Encrypt TLS) → WireGuard → solsys → WAF → Next.js / NestJS,
with the backend's secrets read from Vault at boot. `make deploy` (from a
laptop with SSH to solsys) pulls `branchsaurus` there and runs
`scripts/prod-up.sh`. Full picture: [diagram/architecture.html](diagram/architecture.html).

---

## 👥 Team information

| Member | Intra login | Role | Main areas |
|--------|-------------|------|------------|
| **Moira** | huidris | Product Owner, Technical Lead | backend, trees as organizations, real-time, profiles |
| **Tiara** | tching | Project Manager / Scrum Master | auth (Google, 2FA), site roles and admin panel, security (WAF + Vault), deployment |
| **Jon** | lechan | Technical Lead / Architect | frontend, design system, tree canvas, browsers, accessibility |
| **Yiwei** | yiwei | Developer | search, friends and online status, user management and auth (with Moira and Jon), public API |

| Role | Who | Responsibilities |
|------|-----|------------------|
| **Product Owner (PO)** | Moira | Product vision, feature priorities and backlog; validates completed work; speaks for the team to evaluators and peers |
| **Project Manager (PM) / Scrum Master** | Tiara | Organises meetings and planning, tracks progress and deadlines, keeps communication going, manages risks and blockers |
| **Technical Lead / Architect** | Moira & Jon | Technical architecture and stack decisions, code quality and best practices, reviews of critical changes |
| **Developers** | Moira, Jon, Yiwei, Tiara | Build their assigned modules (below), review each other's code, test and document their work |

---

## 🗂️ Project management

- **Work split:** by module (see [Modules](#-modules)); each module has an
  owner who builds it, demos it and answers for it.
- **Branches:** everyone works on their own branches (`jon3`, `mai3`, `yi5`,
  `tching-solsys`, …). They are merged into **`branchsaurus`** after a merge
  check (trial merge + TypeScript type-check of both apps), then
  `branchsaurus` is fast-forwarded to `main`. Production deploys
  `branchsaurus`.
- **Tracking:** a shared progress tracker page (from 9 Oct) with what is
  outstanding per person, module status, branch picture and risks; plus a
  progress log of decisions and their reasons.
- **Communication:** a team group chat for day-to-day coordination, GitHub
  for code review, and in person for anything secret (certificates, Vault
  unseal shares and passwords are only handed over face to face).
- **Timeline:** feature freeze Tue 13 Oct, code and README final Thu 15 Oct,
  submission Sat 17 Oct.

---

## 🛠️ Technical stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **Next.js 14** (App Router), React 18, TypeScript, **Tailwind CSS 3** | File-based routing, one framework for pages and client code; Tailwind keeps the design system in one place |
| Backend | **NestJS 10**, TypeScript | Modules, guards and DTO validation out of the box: fits role checks and a growing API |
| Database | **PostgreSQL** hosted by **Supabase** | Managed Postgres plus auth, storage and realtime from the same project |
| ORM | **Prisma 7** (`PrismaPg` driver adapter) | Typed queries generated from one schema file |
| Auth | Supabase Auth (email/password, Google OAuth 2.0) + our own JWT, custom TOTP 2FA (`otplib`) | |
| Real-time | Supabase Realtime (broadcast + presence) over WebSocket | |
| Storage | Supabase Storage (`avatars` bucket) for profile photos | |
| Security | ModSecurity + OWASP Core Rule Set (WAF), **HashiCorp Vault** (secrets), AppRole auth | |
| Email | Gmail SMTP (account notices, feedback form) | |
| Deployment | Docker / Docker Compose, `make`; GCP nginx proxy + WireGuard to solsys | |

---

## 🗄️ Database schema

Prisma schema: [backend/src/prisma/schema.prisma](backend/src/prisma/schema.prisma).

| Model | What it holds | Key relations |
|-------|---------------|---------------|
| `User` | site account: username, email, site `role` (ADMIN / MODERATOR / USER), `suspended`, 2FA fields | one `Profile` (the person who is you); friendships; invitations sent |
| `RecoveryCode` | bcrypt-hashed 2FA recovery codes | → `User` (cascade) |
| `Tree` | a family tree: name, slug, join `code`, `isPublic` | owner → `Profile`; root → `TreeMember` |
| `TreeMember` | a person's place in a tree: tree `role` (ADMIN / MEMBER / JOINER / HOLDER), claim status | → `Tree`, → `Profile` |
| `Profile` | a person: names, gender, birth/death dates, photo | `mother`, `father`, `spouse` (self-relations); optional `User` |
| `Friendship` | friend request and its status | requester / addressee → `User` |
| `Invitation` | invitation to a tree with a role | → `Tree`, inviter → `User` |
| `Event` | life events on a person | → `Profile` |
| `AuditLog` | every change made in a tree (source of the live notifications) | → `Tree`, → `Profile` |

Row Level Security is on for every table in Supabase's `public` schema with no
policies, so the public anon key reads nothing; only the backend (table owner)
touches the data.

---

## ✨ Features

| Feature | Where | Who |
|---------|-------|-----|
| Sign up / log in with email and password | `/signup`, `/login` | Moira, Jon, Yiwei, Tiara |
| Forgot / reset password | `/forgot-password`, `/reset-password` | Tiara |
| Log in with Google (OAuth 2.0) | `/login` → `/consent` | Tiara |
| Two-factor authentication: QR enrollment, 8 recovery codes, login challenge | `/settings` | Tiara |
| Settings: change password, change email, delete my account (goodbye email) | `/settings` | Tiara |
| Dashboard: my trees, create a tree, join with a code, delete / leave a tree | `/dashboard` | Jon, Moira |
| Profile: edit, photo upload (JPEG/PNG/WebP/GIF, max 1 MB, checked by content) | dashboard, canvas | Moira, Jon, Yiwei, Tiara |
| Tree canvas: draw the family, add parents / children / spouse, claim yourself, approve claims, remove a member | `/canvas/[id]` | Jon, Moira |
| Who is in the tree right now (presence) and live notifications of changes | canvas | Moira, Tiara |
| Search people with filters, sorting and pages | dashboard | Yiwei |
| Friends: send / accept / reject / cancel / unfriend, list with online status | dashboard | Yiwei |
| Admin panel: list users, change site roles, suspend, delete (with an email to the user) | `/admin/users` | Tiara |
| Feedback form, Privacy Policy, Terms of Service | `/feedback`, `/privacy`, `/terms` | Tiara |
| WAF in front of both apps, secrets from Vault | `docker-compose-security.yml`, `vault/` | Tiara |

---

## 🧩 Modules

We claim **18 points**: 5 Majors (10 pts) + 8 Minors (8 pts). Modules we built
parts of but do not claim, because a part the subject asks for is missing, are
listed after the table.

| # | Module | Type | Pts | Owner | What it shows |
|---|--------|------|-----|-------|---------------|
| 1 | Use a frontend framework (Next.js) | Minor | 1 | Jon | Next.js 14, App Router |
| 2 | Use a backend framework (NestJS) | Minor | 1 | Moira | NestJS 10, global `/api` prefix, guards, DTO validation |
| 3 | Use an ORM (Prisma) | Minor | 1 | Moira | one schema → generated client, transactions for multi-row changes |
| 4 | Custom design system, ≥10 reusable components | Minor | 1 | Jon | palette, typography, icons; Button, Navbar, Footer, Banner, TreeBanner, ModalBanner, Typography, Avatar, PresenceFacepile, SkipLink |
| 5 | Support for additional browsers | Minor | 1 | Jon | Firefox, Safari, Edge (see [Browsers](#-browser-support)) |
| 6 | Remote authentication with OAuth 2.0 (Google) | Minor | 1 | Tiara | Google sign-in through Supabase, checked end to end on production |
| 7 | Two-factor authentication (2FA) | Minor | 1 | Tiara | TOTP, QR enrollment, 8 bcrypt-hashed recovery codes, login challenge |
| 8 | Advanced search (filters, sorting, pagination) | Minor | 1 | Yiwei | `GET /api/profile/search`: name, birth date, gender; `sortBy`, `order`; `page`, `limit` with the total |
| 9 | Advanced permissions system | Major | 2 | Tiara | site roles ADMIN / MODERATOR / USER, `RolesGuard`, admin panel, suspend |
| 10 | Organization system (trees as organizations) | Major | 2 | Moira (UI: Jon) | create, edit, delete a tree; join by code; remove a member; leave; roles inside a tree |
| 11 | Cybersecurity: WAF + HashiCorp Vault | Major | 2 | Tiara | ModSecurity + OWASP CRS in front of both apps; Vault in server mode for the secrets |
| 12 | Accessibility, WCAG 2.1 AA | Major | 2 | Jon | canvas usable by keyboard, real dialogs (focus trap, Escape, focus returns), skip link, landmarks, labelled forms, a title per page; axe 0 violations, Lighthouse accessibility 100 |
| 13 | Standard user management | Major | 2 | Moira, Jon, Yiwei | edit your profile, upload a photo (default avatar if none), friends with requests and online status, your profile on the dashboard and each person's profile on the tree |
| | **Total** | | **18** | | |

### Why each module

- **Frameworks and ORM (1–3).** A family tree is a lot of related rows
  (people, parents, spouses, memberships). Prisma gives typed queries and
  transactions over that graph; NestJS gives guards and validation for every
  route; Next.js gives the pages and the interactive canvas in one codebase.
- **Design system (4).** Many screens share the same banners, buttons and
  avatars; one palette and set of components keeps them consistent and
  accessible (the skip link, labelled controls).
- **Additional browsers (5).** Families use whatever browser they have, often
  Safari on a phone. Testing found real differences (below).
- **OAuth (6) and 2FA (7).** Most relatives won't make a new password; Google
  sign-in removes that step. The tree holds living people's birth dates, so
  accounts get a second factor. 2FA is our own TOTP (not Supabase's MFA), so we
  control enrollment, recovery codes and the challenge on both login paths
  (password and Google).
- **Advanced search (8).** Finding a relative across a large tree needs
  filters and pages, not a scroll.
- **Advanced permissions (9), Major.** A site with personal data needs people
  who can act on abuse: moderators can suspend (which ends that user's sessions
  at once), admins can change roles and delete accounts; self-demotion is
  blocked so the site can't lose its last admin. Every rule is enforced on the
  server by a guard, and the UI changes per role. It spans the database,
  every protected route and a whole admin UI, which is why it is a Major.
- **Organization system (10), Major.** The tree *is* the organization: an
  owner creates it, people join with a code, each member has a role (admin,
  member, joiner) that decides what they can do inside, members can be
  removed, people can leave, and the owner can delete it. This is the core of
  the product, with its own permission model separate from the site roles.
- **WAF + Vault (11), Major.** The data is personal, and the site is public
  on the internet. ModSecurity with the OWASP CRS (paranoia level 2, blocking)
  sits in front of both the frontend and the API, and is the only way in
  (`:3000`/`:4000` are not published). Secrets are not in `.env` on the
  server: the backend logs in to Vault with an AppRole and reads only its own
  path. Production's Vault runs in server mode on solsys: encrypted on disk,
  sealed after a restart until 2 of 5 unseal shares are given, one login per
  person, no root token, every request in the audit log. It took a real
  infrastructure change (and a rehearsal) beyond writing app code.
- **Accessibility, WCAG 2.1 AA (12), Major.** Relatives of every age use a
  family tree, some with a screen reader or only a keyboard. The hardest part
  is the canvas: each person is a real button, arrow keys pan, +/- zoom, 0
  resets, and the view follows focus. The four modals are real dialogs
  (`hooks/useDialog.ts`: focus moves in, Tab is trapped, Escape closes, focus
  returns). Checked with axe (0 violations on the dashboard, canvas, settings,
  each dialog and the admin console) and Lighthouse (accessibility 100 on the
  public pages).
- **Standard user management (13), Major.** A family tree is about people,
  so each account has a profile: name, dates, bio and a photo (JPEG, PNG,
  WebP or GIF, max 1 MB, checked by content; a default avatar until one is
  uploaded). The profile is shown on the dashboard and on that person's node
  in every tree. Friends send, accept, reject and cancel requests, and the
  friends list shows who is online.

### Built but not claimed

| Module | What exists | What is missing for the module |
|--------|-------------|-------------------------------|
| Real-time features (Major) | Supabase Realtime: presence in a tree, live notifications of tree changes, on private per-tree channels | reconnection handling shown, every view updating live |
| Notification system (Minor) | live notifications from the tree audit log, pending claims | notifications for every create/update/delete action |
| Real-time collaboration (Minor) | shared tree canvas with live presence | other people's edits drawn live on the canvas |
| Public API (Major) | `X-API-Key` guard, rate limit (60 a minute), Swagger at `/docs`, GET / POST / PUT on public trees (Yiwei) | 4 endpoints, not the 5 the subject asks for, and no DELETE |

SSR and the user activity analytics dashboard were dropped on 10 Oct.

---

## 🌐 Browser support

Tested with the same flows (sign up, log in, Google, 2FA, dashboard, open a
tree, claim, add a person, settings) in **Google Chrome** (required),
**Firefox**, **Safari** and **Microsoft Edge**, latest stable versions.

Differences we found:
- **Firefox** blocked the realtime WebSocket until the Content Security
  Policy listed Supabase's `wss://` address (Chrome lets `https://` cover it).
  Fixed in `50823fd`; the tree page works the same in both now.
- **Safari**, locally only: each self-signed certificate is accepted
  separately per port, so open both https://localhost:9443 and
  https://localhost:8443 once. The live site has a real certificate, so this
  doesn't apply there.
- **Edge** behaves like Chrome (same engine); nothing specific.

---

## 🙋 Individual contributions

### Moira (huidris)
- Backend framework (NestJS) and ORM (Prisma): the schema and the services.
- Organization system: trees, join codes, member roles, claims, remove a
  member, delete a tree; the tree roles decision (admin / member / joiner).
- Real-time presence and notifications (with Tiara); profile photos on the
  dashboard and the tree; landing page; skip link.

### Jon (lechan)
- Frontend framework (Next.js) and the design system components.
- The tree canvas: nodes, connector lines, spouses; Delete / Leave Tree
  buttons; alive / deceased toggle.
- Browser testing.
- Accessibility (WCAG 2.1 AA): the canvas by keyboard, dialogs with focus
  handling, skip link, landmarks, labels, page titles; the axe and Lighthouse
  checks.

### Yiwei (yiwei)
- Advanced search with filters, sorting and pagination.
- Friends: requests, current friends, online status on the dashboard.
- Standard user management and auth, with Moira and Jon: sign up / log in,
  profile edit and photos.
- Public API (built, not claimed).

### Tiara (tching)
- Google OAuth, 2FA, site roles with the admin panel and suspension.
- Cybersecurity: WAF (ModSecurity + OWASP CRS) and HashiCorp Vault, in
  server mode on solsys with per-person logins through SSH tunnels.
- Deployment (GCP proxy, WireGuard, solsys), Supabase RLS fix and private
  realtime channels, account settings (change email / password, delete
  account), account emails, privacy policy and terms.
- Project management: tracker, merges into `branchsaurus`, deadlines.

---

## 📚 Resources

- [Next.js docs](https://nextjs.org/docs), [React docs](https://react.dev)
- [NestJS docs](https://docs.nestjs.com)
- [Prisma docs](https://www.prisma.io/docs)
- [Supabase docs](https://supabase.com/docs) (Auth, Realtime, Storage, RLS)
- [Tailwind CSS docs](https://tailwindcss.com/docs)
- [OWASP Core Rule Set](https://coreruleset.org/docs/) and
  [ModSecurity](https://github.com/owasp-modsecurity/ModSecurity)
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs) (AppRole, KV v2, seal/unseal)
- [RFC 6238 (TOTP)](https://datatracker.ietf.org/doc/html/rfc6238), [otplib](https://github.com/yeojz/otplib)
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)
- [Docker Compose docs](https://docs.docker.com/compose/)

### How AI was used

Our rule: **only keep code you can explain line by line.** AI suggestions
were read, tested and often rewritten before being committed.

- **Tiara** used Claude Code as a pair programmer for her modules and the
  deployment. She set the plan and the rules (for example, schema pushes to
  the shared database were run by her, never by the tool), tested every change
  herself, and kept a progress log of every session, so each decision has a
  written reason.
- An early `copilot/setup-docker-environment` branch (June, generated by
  GitHub's Copilot agent) was never merged.

---

## 🧪 Running Supabase Locally

For testing/schema changes without touching the shared dev Supabase
project. All of this is optional — the shared `.env` values still work
fine if you don't need this.

**Shortcut:** `make local` runs `supabase start` if it isn't already, reads
its keys automatically, and brings the whole stack (`make up`) up pointed at it — handles the `host.docker.internal`
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
`make local` does this for you after the containers start
(`npx prisma db push` inside the backend container, so the host needs no Node; a
re-run with no schema change does nothing). By hand:
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
Docker, check `docker exec familytree-backend-1 sh -c 'echo $DATABASE_URL
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
`backend`, plus Vault. They live in their own compose file
(`docker-compose-security.yml`) and are part of `make up`. See `diagram/architecture.html` for the full request-flow
diagram (open it directly in a browser, no server needed).

```bash
make up                # the app, both WAFs and Vault
make down              # tears it all down
```

In this stack the WAF is the **only** way in: `:3000` and `:4000` are not
published to your machine (`ports: !reset []` in
`docker-compose-security.yml`, which needs Docker Compose 2.24 or newer). The
WAFs still reach the frontend and backend over the Docker network.
- `https://localhost:8443` → frontend, inspected — **open the app here**
- `https://localhost:9443` → backend API, inspected (the app's browser calls go here)

To see a request that the WAF blocks reach the app unfiltered, start the app
without the security file (`docker compose up -d`, which publishes `:3000` and
`:4000`) and send it to `:4000`.

**Dependency note:** the WAFs depend on the containers behind them. Their
nginx looks up `backend`'s and `frontend`'s addresses once, when it starts, so
whenever `backend` or `frontend` is recreated while the WAF is running, restart
the WAFs (`docker restart familytree-waf-backend-1 familytree-waf-frontend-1`),
or they answer `502`. `make up`, `make backend`, `make frontend` and
`scripts/prod-up.sh` do this by themselves.

### Vault (secrets management)

`make up` also starts a HashiCorp Vault (dev mode) and runs
`scripts/vault-init.sh`, which:
1. Writes `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
   `DATABASE_URL`/`DIRECT_URL`, `SUPABASE_AUTH_URL` into Vault's KV v2
   store at `secret/data/family-tree/backend`. Each value is taken from the
   environment when it is set there (`make up` with `VAULT_USER` set gets them
   from the solsys Vault; `local-up.sh` sets the local Supabase ones), otherwise from
   `.env`. It stops with an error if a required one is empty.
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
`.env`. If `VAULT_ADDR` isn't set (i.e. the backend was started with a plain
`docker compose up`, without `vault-init.sh`), it's a no-op and everything falls back to `.env`
exactly like before Vault existed.

**Why this resets every time**: Vault here runs in **dev mode** — no
storage backend, everything in-memory, auto-unsealed with a hardcoded
root token. That's why `vault-init.sh` isn't a one-time setup script, it
re-bootstraps the secret + AppRole on every `make up`, because the
previous run's data is gone the moment the `vault` container restarts.
This is explicitly not production-ready, same caveat the subject itself
calls out — a real deployment needs a persistent storage backend (file or
Raft), TLS, and proper unsealing instead of a baked-in root token.

**To verify it yourself**: `docker logs familytree-backend-1 | grep vault`
should show `[vault] loaded 5 secrets from secret/data/family-tree/backend`.
If it instead says "VAULT_ADDR/VAULT_ROLE_ID/VAULT_SECRET_ID not set",
`backend` was started without going through `make up`/`vault-init.sh`.


### Vault on solsys (production)

Production does **not** use the dev-mode Vault above. Since 13 Oct it runs a
server-mode Vault on solsys (the Vault server, HashiCorp Vault)
([vault/README.md](vault/README.md)):

- **Server mode**: encrypted on disk, keeps its data across restarts, sealed
  after every restart until 2 of 5 unseal shares are entered (`make unseal`,
  from any share holder's laptop through their SSH tunnel; solsys applies its
  own share automatically).
- **Two paths**: `secret/family-tree/prod`, read only by the production
  backend's AppRole, and `secret/family-tree/dev`, read by everyone's
  `make up`. Each person has their own Vault login; there is no root token.
  Every request goes to the audit log.
- **`make deploy`** (laptop with SSH to solsys) pulls `branchsaurus` there and
  runs `scripts/prod-up.sh`, which uses this Vault through the backend's login
  file (`vault/backend-approle.env`).

---

## 🗃️ Codebase overview

### Frontend (Next.js, `frontend/src`)
- `app/page.tsx` – landing page
- `app/login`, `app/signup`, `app/forgot-password`, `app/reset-password` – email/password
  auth and Google; a 2FA code prompt appears inline when a login needs it
- `app/consent` – OAuth callback, also handles the 2FA challenge for Google logins
- `app/dashboard` – my trees (create, join with a code, delete / leave), profile and
  photo, search, friends, links to Settings and (role-gated) the admin panel
- `app/canvas/[id]` – the tree canvas: people, claims, members, presence, notifications
- `app/settings` – 2FA, change password, change email, delete account
  (old `/settings/2fa` links redirect here)
- `app/admin/users` – user list, role changes, suspend, delete
- `app/feedback`, `app/privacy`, `app/terms`
- `components/` – the design system (`Button`, `Navbar`, `Footer`, `Banner`,
  `TreeBanner`, `ModalBanner`, `Typography`, `Avatar`, `PresenceFacepile`,
  `SkipLink`) and the canvas pieces (`treeNode`, `treeBranch`, `profileModal`, …)

### Backend (NestJS, `backend/src`, every route under `/api`)
- `api/auth` – Supabase login + our JWT, global `RolesGuard`, account changes and deletion
- `api/auth/two-factor` – TOTP setup / enable / disable / login-verify
- `api/users` – user list (admin and moderator), role change and delete (admin), suspend (admin and moderator)
- `api/profile` – people: CRUD, photo upload, search
- `api/tree` – trees: create, join, members, roles, claims, delete, leave; audit log + realtime broadcast
- `api/friend` – friend requests, friends list, online status
- `api/feedback` – feedback form (email)
- `api/public` – public API (not claimed)
- `prisma/` – schema and the Prisma client (`PrismaPg` adapter)
- `vault/load-secrets.ts` – reads the secrets from Vault at boot

### Infrastructure
- `docker-compose.yml` (app), `docker-compose-security.yml` (WAFs + Vault),
  `docker-compose.prod.yml`, `docker-compose.vault-server.yml`
- `waf/` – ModSecurity + CRS config and `test-waf.sh`
- `vault/` – server-mode Vault scripts and setup guide
- `scripts/` – `vault-init.sh`, `local-up.sh`, `prod-up.sh`, …
- `diagram/` – architecture and Vault diagrams (open in a browser)
