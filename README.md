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
`curl` and `python3` (used by `scripts/vault-init.sh`), `openssl` (for the
local self-signed certificates), and the
[Supabase CLI](https://supabase.com/docs/guides/cli) only for `make local`.
Node is not needed on the host.

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
`make build`, `make backend` / `make frontend` (rebuild one side, with the
same settings as your last `make up` or `make local`),
`make local` (run against a local Supabase, below), `make clean` (stop and
delete the containers' volumes), `make fclean` (also the built images) and
`make re` (`fclean`, then `make up`, or `make local` if that was your last
one). None of them touch the shared
database; `make local` pushes the schema to your local Supabase only.

**Team members with a Vault login** leave the secret lines in `.env` empty and
set `VAULT_USER` once to your intra login (e.g. `export VAULT_USER=huidris` in
`~/.zshrc`). `make up`
then opens your own SSH tunnel to the Vault on solsys (the Vault server,
HashiCorp Vault), asks your Vault password (once a day), and keeps the dev
secrets in memory only. It runs on the
**production Supabase** (the real users' data: test on your own test trees and
accounts), with its own JWT secret and no email password. One-time setup (your SSH
key and Vault login, from Tiara): [vault/README.md](vault/README.md); how it fits
together: [diagram/vault-remote-env.html](diagram/vault-remote-env.html) and
[diagram/local-dev.html](diagram/local-dev.html). Evaluators who want to look
inside the production Vault: [vault/EVALUATOR.md](vault/EVALUATOR.md).

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
| **Tiara** | tching | Project Manager / Scrum Master | auth (Google, MFA), site roles and admin panel, security (WAF + Vault), deployment |
| **Jon** | lechan | Technical Lead / Architect | frontend, design system, tree canvas, browsers, accessibility |
| **Yiwei** | yiwei | Developer | search, friends and online status, user management and auth (with Moira and Jon) |

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
| Frontend | **Next.js 14** (App Router), React 18, TypeScript 5, **Tailwind CSS 3** | File-based routing, one framework for pages and client code; Tailwind keeps the design system's colours, type and spacing in one place |
| Backend | **NestJS 10**, TypeScript 5 | Modules, guards and DTO validation out of the box: every route gets the same role and input checks, which a site with personal data needs |
| Database | **PostgreSQL** hosted by **Supabase** | Relational data (people, parents, spouses, memberships) fits SQL; Supabase gives managed Postgres plus auth, storage and realtime from one project |
| ORM | **Prisma 7** (`PrismaPg` driver adapter) | Typed queries generated from one schema file, and transactions for changes that touch several people at once |
| Auth | Supabase Auth (email/password, Google OAuth 2.0) + our own JWT; our own TOTP **MFA** (`otplib`, bcrypt-hashed recovery codes) | Supabase stores and hashes passwords and runs the Google flow, so we never handle raw credentials. Our JWT carries the site role, read again from the database on every request, so a suspension or role change applies at once. MFA is our own so the challenge works the same on both login paths, and site admins and moderators can be required to have it. The session token lives in an HttpOnly, Secure, SameSite=Strict cookie (page JavaScript can't read it), lasts an hour, and Logout revokes it on the server |
| Real-time | Supabase Realtime (broadcast + presence) over WebSocket | Already part of the Supabase project: private per-tree channels for live changes and who is on a tree, one site-wide channel for friends' online status, with no extra server to run |
| Storage | Supabase Storage (`avatars` bucket) for profile photos | Photos stay out of the database and the app server; the backend checks type and size (max 1 MB) before upload |
| Security | ModSecurity + OWASP Core Rule Set (WAF), **HashiCorp Vault** (secrets), AppRole auth, a strict Content Security Policy (per-request script nonce) | The site is public and holds personal data: the WAF blocks common attacks before they reach either app, Vault keeps production secrets out of `.env` files, with an audit log of every read, and the CSP only runs the scripts the page itself serves |
| Email | Gmail SMTP via `nodemailer` (account notices, feedback form) | Free and reliable for the small volume we send: role changes, suspensions, account deletion, feedback |
| Deployment | Docker / Docker Compose (Node 22 Alpine images), `make`; GCP nginx proxy + WireGuard to solsys (the Vault server, HashiCorp Vault) | One command starts the whole stack the same way on every machine; the GCP proxy gives a public IP and HTTPS while the app runs on our own server |

---

## 🗄️ Database schema

Prisma schema: [backend/src/prisma/schema.prisma](backend/src/prisma/schema.prisma).

| Model | What it holds | Key relations |
|-------|---------------|---------------|
| `User` | site account: username, email, site `role` (MODERATOR / USER), `suspended`, MFA fields | one `Profile` (the person who is you); friendships; invitations sent |
| `Admin` | site admin account ("Sign in as staff"), kept apart from `User`: no profile, trees or friends | added by another admin; recovery codes |
| `Guest` | one "Try as guest" visitor: random tag, last seen | its own `Profile` (and demo tree) |
| `RevokedToken` | sessions ended with Logout, by token id, until they would have expired | — |
| `SiteSettings` | one row: whether "Try as guest" is on | — |
| `RecoveryCode` | bcrypt-hashed MFA recovery codes | → `User` or `Admin` (cascade) |
| `Tree` | a family tree: name, slug, join `code`, `isPublic` | owner → `Profile`; root → `TreeMember` |
| `TreeMember` | a person's place in a tree: tree `role` (ADMIN / MEMBER / JOINER / HOLDER), claim status | → `Tree`, → `Profile` |
| `Profile` | a person: names, gender, birth date, bio, photo | `mother`, `father`, `spouse` (self-relations); optional `User` |
| `Friendship` | friend request and its status | requester / addressee → `User` |
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
| Multi-factor authentication (MFA): QR enrollment, 8 recovery codes, login challenge; required for site admins and moderators | `/settings` | Tiara |
| Try as guest: each click gets a fresh guest with its own demo tree (30 an hour, removed after 15 minutes idle; admins can turn it off) | `/guest` | Tiara |
| Settings: change password, change email, delete my account (goodbye email) | `/settings` | Tiara |
| Dashboard: my trees, create a tree, join with a code, delete / leave a tree | `/dashboard` | Jon, Moira |
| Profile: edit, photo upload (JPEG/PNG/WebP/GIF, max 1 MB, checked by content) | dashboard, canvas | Moira, Jon, Yiwei, Tiara |
| Tree canvas: draw the family, add parents / children / spouse, claim yourself, approve claims, remove a member | `/canvas/[id]` | Jon, Moira |
| Who is in the tree right now (presence) and live notifications of changes | canvas | Moira, Tiara |
| Search people by first or last name, with filters, sorting and pages (gender and birth date only shown to friends) | dashboard | Yiwei |
| Friends: send / accept / reject / cancel / unfriend, list with online status | dashboard | Yiwei |
| Admin console: users (change site roles, suspend, delete, with an email to the user), every tree, admin accounts, guest access on/off | `/admin` (sign in at `/staff`) | Tiara |
| Moderator console: users (suspend) and a read-only view of every tree; needs MFA | `/moderator` | Tiara |
| Feedback form, Privacy Policy, Terms of Service | `/feedback`, `/privacy`, `/terms` | Tiara |
| WAF in front of both apps, secrets from Vault | `docker-compose.yml`, `waf/`, `vault/` | Tiara |

---

## 🧩 Modules

We claim **22 points**: 6 Majors (12 pts) + 10 Minors (10 pts). Modules we built
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
| 7 | Two-factor authentication (2FA), as MFA | Minor | 1 | Tiara | TOTP, QR enrollment, 8 bcrypt-hashed recovery codes, login challenge; site admins and moderators must have it |
| 8 | Advanced search (filters, sorting, pagination) | Minor | 1 | Yiwei | `GET /api/profile/search`: first or last name, birth date, gender (those two for friends only); `sortBy`, `order`; `page`, `limit` with the total |
| 9 | Advanced permissions system | Major | 2 | Tiara | site roles ADMIN / MODERATOR / USER, `RolesGuard`, admin and moderator consoles, suspend |
| 10 | Organization system (trees as organizations) | Major | 2 | Moira (UI: Jon) | create, edit, delete a tree; join by code; remove a member; leave; roles inside a tree |
| 11 | Cybersecurity: WAF + HashiCorp Vault | Major | 2 | Tiara | ModSecurity + OWASP CRS in front of both apps; Vault in server mode for the secrets |
| 12 | Accessibility, WCAG 2.1 AA | Major | 2 | Jon | canvas usable by keyboard, real dialogs (focus trap, Escape, focus returns), skip link, landmarks, labelled forms, a title per page; axe 0 violations, Lighthouse accessibility 100 |
| 13 | Standard user management | Major | 2 | Moira, Jon, Yiwei | edit your profile, upload a photo (default avatar if none), friends with requests and online status, your profile on the dashboard and each person's profile on the tree |
| 14 | Real-time features (WebSockets) | Major | 2 | Moira | Supabase Realtime on private per-tree channels: who is in the tree right now, live notices of changes; friends' online status on a site-wide channel |
| 15 | Notification system (create / update / delete) | Minor | 1 | Moira, Tiara | live notices from the tree audit log, pending claims to approve, friend requests (incoming and sent) on the dashboard |
| 16 | Real-time collaboration | Minor | 1 | Moira, Jon | several people edit one tree at once; each canvas redraws when someone else changes it, with who is there shown on top |
| | **Total** | | **22** | | |

### Why each module

- **Frameworks and ORM (1–3).** A family tree is a lot of related rows
  (people, parents, spouse, memberships). Prisma gives typed queries and
  transactions over that graph; NestJS gives guards and validation for every
  route; Next.js gives the pages and the interactive canvas in one codebase.
- **Design system (4).** Many screens share the same banners, buttons and
  avatars; one palette and set of components keeps them consistent and
  accessible (the skip link, labelled controls).
- **Additional browsers (5).** Families use whatever browser they have, often
  Safari on a phone. Testing found real differences (below).
- **OAuth (6) and MFA (7).** Most relatives won't make a new password; Google
  sign-in removes that step. The tree holds living people's birth dates, so
  accounts get a second factor. MFA is our own TOTP (not Supabase's built-in
  MFA), so we control enrollment, recovery codes and the challenge on both
  login paths (password and Google). Site admins and moderators can act on
  other people's accounts, so they must have MFA: until it's on, an admin's
  session only reaches MFA setup, and a moderator lands on Settings instead of
  the moderator console.
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
- **Real-time (14), notifications (15) and collaboration (16).** A family
  fills in a tree together, often at the same time. Every change to a tree
  writes an audit row; Supabase Realtime sends it over a WebSocket on that
  tree's private channel, so everyone on the tree gets a notice and their
  canvas redraws. Presence shows who is on the tree, and a site-wide
  channel gives friends' online status. Claims to approve and friend
  requests wait on the dashboard until someone acts on them.

### Built but not claimed

A public API (Yiwei: `X-API-Key` guard, rate limit, Swagger) had 4 endpoints,
not the 5 the subject asks for, and no DELETE, so it was not claimed and was
removed from the code on 18 Oct. SSR and the user activity analytics dashboard
were dropped on 10 Oct.

---

## 🌐 Browser support

Tested with the same flows (sign up, log in, Google, MFA, dashboard, open a
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
- Real-time: presence and live notifications (with Tiara), real-time
  collaboration on the canvas (with Jon); profile photos on the dashboard and
  the tree; landing page; skip link.

### Jon (lechan)
- Frontend framework (Next.js) and the design system components.
- The tree canvas: nodes, connector lines, spouses; Delete / Leave Tree
  buttons.
- Browser testing; real-time collaboration on the canvas (with Moira).
- Accessibility (WCAG 2.1 AA): the canvas by keyboard, dialogs with focus
  handling, skip link, landmarks, labels, page titles; the axe and Lighthouse
  checks.

### Yiwei (yiwei)
- Advanced search with filters, sorting and pagination.
- Friends: requests, current friends, online status on the dashboard.
- Standard user management and auth, with Moira and Jon: sign up / log in,
  profile edit and photos.
- Public API (built, not claimed, removed on 18 Oct).

### Tiara (tching)
- Google OAuth, MFA, site roles with the admin and moderator consoles and
  suspension; Try as guest; the session cookie and the CSP.
- Notifications (with Moira): private per-tree realtime channels.
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
- [Using a nonce with CSP](https://content-security-policy.com/nonce/) (the per-request script nonce)
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
project. All of this is optional: `make up` stays on the shared project.

**Use `make local`.** It runs `supabase start` if it isn't already, reads
its keys automatically, and brings the whole stack up (`make stack`, what
`make up` runs) pointed at it, then pushes the schema and turns on RLS. It
handles the `host.docker.internal` override and key copy-pasting below for
you, and writes `local` to `.stack-mode`, so later `make backend` /
`make frontend` stay on local Supabase. The secrets it doesn't take from
local Supabase (`JWT_SECRET`, `SMTP_PASS`) come from Vault when `VAULT_USER`
is set, otherwise from `.env`. The steps below are what that script is
actually doing, useful if something goes wrong or you want to do it by hand.

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
Run `make up`: it writes `shared` to `.stack-mode` and takes the shared
project's values again (from Vault, or from `.env` if you edited it by hand
above: restore your original values first). Nothing about local Supabase
touches the shared project.

---

## 🛡️ Cybersecurity module (WAF + Vault)

ModSecurity + the OWASP Core Rule Set, fronting both `frontend` and
`backend`, plus Vault. They are in `docker-compose.yml` with the app, so `make up`
always starts them. See `diagram/architecture.html` for the full request-flow
diagram (open it directly in a browser, no server needed).

```bash
make up                # the app, both WAFs and Vault
make down              # tears it all down
```

In this stack the WAF is the **only** way in: `:3000` and `:4000` are not
published to your machine (`docker-compose.yml` gives them no `ports:`). The
WAFs still reach the frontend and backend over the Docker network.
- `https://localhost:8443` → frontend, inspected — **open the app here**
- `https://localhost:9443` → backend API, inspected (the app's browser calls go here)

To see a request that the WAF blocks reach the app unfiltered, send it to the
backend from inside the Docker network, where no WAF sits in between:
`docker run --rm --network familytree_default curlimages/curl -sk "https://backend:4000/api/..."`.

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
   `DATABASE_URL`/`DIRECT_URL`, `SUPABASE_AUTH_URL` and `SMTP_PASS` (optional:
   without it the feedback form answers 503) into Vault's KV v2
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
should show `[vault] loaded 6 secrets from secret/data/family-tree/backend`.
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
  auth and Google; an MFA code prompt appears inline when a login needs it
- `app/consent` – OAuth callback, also handles the MFA challenge for Google logins
- `app/dashboard` – my trees (create, join with a code, delete / leave), profile and
  photo, search, friends, links to Settings and (role-gated) the admin panel
- `app/canvas/[id]` – the tree canvas: people, claims, members, presence, notifications
- `app/settings` – MFA, change password, change email, delete account
  (old `/settings/2fa` links redirect here)
- `app/staff` – "Sign in as staff": the admin sign-in, email and password only, no sign-up
- `app/guest` – Try as Guest: a fresh guest with its own demo tree on every click
- `app/admin` – the admin console: overview, users (role changes, suspend, delete), every tree
  (view, delete), admin accounts (add, remove), guest access on/off
- `app/moderator` – the moderator console (MFA required): users (suspend) and a
  read-only view of every tree
- `app/feedback`, `app/privacy`, `app/terms`
- `components/` – the design system (`Button`, `Navbar`, `Footer`, `Banner`,
  `TreeBanner`, `ModalBanner`, `Typography`, `Avatar`, `PresenceFacepile`,
  `SkipLink`) and the canvas pieces (`treeNode`, `treeBranch`, `profileModal`, …)

### Backend (NestJS, `backend/src`, every route under `/api`)
- `api/auth` – Supabase login + our JWT in an HttpOnly session cookie, logout (revokes the
  session), Try as guest, global `RolesGuard`, account changes and deletion
- `api/auth/two-factor` – MFA (TOTP) setup / enable / disable / login-verify
- `api/admin` – console stats and every tree: list and view (admin and moderator), delete (admin);
  admin accounts and the guest-access switch (admin)
- `api/users` – user list (admin and moderator), role change and delete (admin), suspend (admin and moderator)
- `api/profile` – people: CRUD, photo upload, search
- `api/tree` – trees: create, join, members, roles, claims, delete, leave; audit log + realtime broadcast
- `api/friend` – friend requests, friends list, online status
- `api/feedback` – feedback form (email)
- `prisma/` – schema and the Prisma client (`PrismaPg` adapter)
- `vault/load-secrets.ts` – reads the secrets from Vault at boot

### Infrastructure
- `docker-compose.yml` (app + WAFs + Vault), `docker-compose.prod.yml`
  (production builds), `docker-compose.vault-server.yml` (server-mode Vault)
- `waf/` – ModSecurity + CRS config and `test-waf.sh`
- `vault/` – server-mode Vault scripts and setup guide
- `scripts/` – `vault-init.sh`, `local-up.sh`, `prod-up.sh`, …
- `diagram/` – architecture, Vault and local-dev diagrams (open in a browser)
