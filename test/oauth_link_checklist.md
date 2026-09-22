# OAuth / redirect link checklist — going from local to production

Companion to README's "Google/GitHub OAuth locally" section, which covers the same three
places (GCP, GitHub, Supabase) for **local** dev. This is the same checklist for **production**
— do it once when you have a real frontend domain, and again any time that domain changes.

**Known now** (doesn't depend on the frontend domain):
- Production Supabase project ref: **not written here on purpose — this repo is public on
  GitHub.** Get it from `.env.remote-backup` (gitignored, `SUPABASE_AUTH_URL`) or
  `supabase projects list` (needs `supabase login`). Call it `<PROJECT_REF>` below.
- Its fixed auth callback (this is what Google/GitHub need to know about, not your frontend):
  `https://<PROJECT_REF>.supabase.co/auth/v1/callback`

**Not known yet** — fill in once decided (see `vision.md` Phase 3, hosting not chosen):
- Production frontend URL: `https://____________________`

The browser never talks to Google/GitHub directly — `signInWithOAuth()` sends it to
Supabase, which redirects to the provider, which redirects back to **Supabase's own fixed
callback** above, which then redirects to your app's `redirectTo` (`/consent`,
`/reset-password`). So Google/GitHub only ever need Supabase's callback URL, not your
frontend's. Only Supabase needs your frontend's actual URL.

## 1. Google Cloud Console (GCP)

- [ ] Open the existing OAuth 2.0 Client ID (APIs & Services → Credentials) used for local dev
      — reuse the same client, don't create a new one, so one secret covers local + prod.
- [ ] **Authorized redirect URIs**: add `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
      (keep the existing `http://127.0.0.1:54321/auth/v1/callback` too — local dev still needs it).
- [ ] Authorized JavaScript origins: probably not required for this flow (Supabase exchanges
      the code server-side, the browser never calls Google's JS SDK) — but the field exists in
      the console; adding your production frontend origin there doesn't hurt if you see it asked for.
- [ ] **OAuth consent screen → Publishing status.** While it's "Testing", only up to 100
      explicitly-added test users can sign in — real users get blocked. Move it to "In
      production" before you actually launch. Check whether your requested scopes
      (email/profile) trigger Google's verification review — basic sign-in scopes usually don't,
      but confirm in the console before assuming.
- [ ] Note the redirect URI change takes effect immediately; no redeploy needed on Google's side.

## 2. GitHub (OAuth App)

- [ ] Settings → Developer settings → OAuth Apps → the existing app used for local dev (reuse it,
      same reasoning as above).
- [ ] **Authorization callback URL**: this field only takes **one** URL in a classic GitHub OAuth
      App (unlike Google, which allows a list) — check whether the current value is still the
      local one. If GitHub only allows one, you'll need to either:
      - switch it to the production callback once you stop needing local GitHub-login testing, or
      - register a **second** OAuth App for production and give Supabase's production project
        that app's client ID/secret instead of reusing the local one.
      Confirm which GitHub actually allows before assuming — this may have changed.
- [ ] Update **Homepage URL** to the production frontend URL (cosmetic, but do it).
- [ ] No review/verification step for GitHub OAuth Apps used for login — unlike Google, there's
      nothing else to "publish".

## 3. Supabase (production project — the **Dashboard**, not `supabase/config.toml`)

`supabase/config.toml` only configures the **local** `supabase start` stack. None of it applies
to the hosted production project automatically — these all need setting again in the Supabase
Dashboard for `<PROJECT_REF>` (Authentication section), unless you deliberately use
`supabase config push` to sync `config.toml` to the linked project (confirm this covers auth
settings before relying on it — hasn't been tried here).

- [ ] **Authentication → Providers → Google**: enable, paste the *production* client ID/secret
      (same OAuth app as above, since it now has both callback URLs registered).
- [ ] **Authentication → Providers → GitHub**: same, using whichever OAuth App you decided on
      in step 2.
- [ ] **Authentication → URL Configuration**:
  - Site URL → the production frontend URL.
  - Redirect URLs → add the production equivalents of what's in `additional_redirect_urls`
    locally: `<prod-url>`, `<prod-url>/consent`, `<prod-url>/**` (and `/reset-password` is
    covered by `/**`, but list it explicitly too if you'd rather not rely on the wildcard).
- [ ] **Authentication → Providers → Email → Minimum password length**: set to `8`, matching
      `minimum_password_length` in `supabase/config.toml` — this is exactly the kind of setting
      that does **not** carry over from local automatically; check it explicitly.
- [ ] **Authentication → Emails (SMTP)**: local dev's email (the Inbucket inbox at
      `127.0.0.1:54324`) does not exist in production. Without a custom SMTP provider
      configured, the hosted project's built-in email sending has a **very low rate limit**
      (a handful of emails per hour) — nowhere near enough for real signup confirmations or
      password resets. Configure a real SMTP provider (Resend, SendGrid, Postmark, etc.) before
      relying on `/forgot-password` or email confirmations in production.
- [ ] Re-check `RecoveryCode` and the 2FA columns exist in production's `User` table — the
      schema drift found during the 2026-09-22 production backup means these are **not there
      yet**; `prisma db push` (or migrations) need to run against production before 2FA/recovery
      will work there at all. Separate task from this checklist, but blocks it in practice.

## 4. The app's own config (not GCP/GitHub/Supabase, but part of the same "going live" step)

- [ ] `.env` (wherever the production backend/frontend actually run): `SUPABASE_AUTH_URL` /
      `NEXT_PUBLIC_SUPABASE_URL` → `https://<PROJECT_REF>.supabase.co`;
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` → the production project's
      real keys (`supabase status`'s local values don't apply — get these from the Dashboard's
      API settings for this project). Confirm `SUPABASE_SERVICE_ROLE_KEY` is the actual
      service-role key, not the publishable one — this exact mistake was already made once for
      local dev (see `backend.md`).
- [ ] `CORS_ORIGIN` → the production frontend origin (same pattern as `make security`
      overriding it to `:8443` for the WAF stack — production needs its own value).
- [ ] `NEXT_PUBLIC_API_URL` → wherever the production backend is actually reachable.
- [ ] `.env.remote-backup` currently holds these production values already (minus the frontend
      URL, which wasn't decided when it was written) — treat it as the starting point, not as
      already-correct; re-verify every value against the Dashboard before using it for a real launch.

## Do this again whenever the frontend domain changes

Every URL in sections 1, 2 and 3 (except Supabase's own fixed callback) is tied to the
frontend's domain. A domain change (custom domain, hosting provider change, etc.) means
repeating this whole checklist, not just updating the frontend.
