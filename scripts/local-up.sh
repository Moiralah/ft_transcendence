#!/bin/sh
# Point the stack at local Supabase (`supabase start`) instead of the shared
# dev DB, then bring up the whole stack (app + WAFs + Vault) with `make stack`
# (what `make up` runs), so the actual Docker orchestration logic (and its
# dependency fixes) lives in exactly one place.
#
# Usage:
#   make local    (runs this, under scripts/vault/with-secrets.sh when VAULT_USER is set)
#   make backend / make frontend after `make local` run this with backend-stack /
#   frontend-stack: same settings, only that side is rebuilt, no schema push.
#
# Handles the two dependency notes documented in README > "Running Supabase Locally":
# containers reach local Supabase via host.docker.internal, not 127.0.0.1
# (which inside a container means the container itself); the browser uses
# 127.0.0.1 directly. And it reads the local anon/service-role keys straight
# from `supabase status`, so there's no manual copy-pasting into .env.
set -e
cd "$(dirname "$0")/.."
TARGET="${1:-stack}"

if ! supabase status >/dev/null 2>&1; then
  echo "[local-up] local Supabase not running — starting it (first run pulls"
  echo "           images, can take a while)..."
  supabase start
fi

echo "[local-up] reading local Supabase keys..."
STATUS_ENV=$(supabase status -o env)
# The new-style keys (sb_publishable_ / sb_secret_), like production. The
# status lists the legacy JWT keys (ANON_KEY, SERVICE_ROLE_KEY) first, so
# take a name in order of preference, not the first line that matches; the
# legacy names are only a fallback for an older Supabase CLI.
status_value() {
  for name in "$@"; do
    value=$(echo "$STATUS_ENV" | grep -E "^$name=" | head -1 | cut -d= -f2- | tr -d '"')
    if [ -n "$value" ]; then echo "$value"; return; fi
  done
}
ANON_KEY=$(status_value PUBLISHABLE_KEY ANON_KEY)
SERVICE_ROLE_KEY=$(status_value SECRET_KEY SERVICE_ROLE_KEY)

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "[local-up] couldn't parse keys from 'supabase status -o env' — check it" >&2
  echo "           manually, the expected key names may have changed:" >&2
  echo "$STATUS_ENV" >&2
  exit 1
fi

export DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:54322/postgres"
export DIRECT_URL="$DATABASE_URL"
export SUPABASE_AUTH_URL="http://host.docker.internal:54321"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
# Photo links the backend stores must be loadable by the browser, which can't
# resolve host.docker.internal (profile.service.ts uploadPhoto).
export SUPABASE_PUBLIC_URL="$NEXT_PUBLIC_SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
# vault-init.sh takes each value from the environment before .env, so these
# win over a .env (or Vault dev secrets) that point at the cloud project.

echo local > .stack-mode
echo "[local-up] make $TARGET against local Supabase..."
make --no-print-directory "$TARGET"
[ "$TARGET" = stack ] || exit 0

# A fresh local Supabase has no tables. Push the Prisma schema from inside the
# backend container (it already has the Prisma CLI), so the host needs no Node.
# Safe to re-run: no changes means nothing happens, and a change that would lose
# data stops with an error instead of applying it (no --accept-data-loss).
echo "[local-up] pushing the database schema to local Supabase..."
for attempt in 1 2 3 4 5 6; do
  if docker compose exec -T \
      -e DIRECT_URL="$DIRECT_URL" -e DATABASE_URL="$DATABASE_URL" \
      backend npx prisma db push; then
    break
  fi
  if [ "$attempt" = 6 ]; then
    echo "[local-up] schema push failed; see the error above (the app is up, but tables may be missing)" >&2
    exit 1
  fi
  echo "[local-up] backend not ready yet, retrying in 5 s..."
  sleep 5
done

# The push makes new tables with RLS off; turn it on for every table.
echo "[local-up] turning on RLS for every table..."
if ! docker compose exec -T \
    -e DIRECT_URL="$DIRECT_URL" -e DATABASE_URL="$DATABASE_URL" \
    backend npx prisma db execute --stdin < scripts/db/enable-rls.sql; then
  echo "[local-up] enabling RLS failed; see the error above" >&2
  exit 1
fi

echo "[local-up] done. Open https://localhost:8443"
