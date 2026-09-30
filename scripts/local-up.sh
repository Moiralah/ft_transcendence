#!/bin/sh
# Point the stack at local Supabase (`supabase start`) instead of the shared
# dev DB, then bring up either the plain stack or the WAF+Vault security
# stack — via the existing Makefile targets, so the actual Docker
# orchestration logic (and its gotcha fixes) lives in exactly one place.
#
# Usage:
#   ./scripts/local-up.sh            # plain `make up`, against local Supabase
#   ./scripts/local-up.sh security   # `make security`, against local Supabase
#
# Handles the two gotchas documented in README > "Running Supabase Locally":
# containers reach local Supabase via host.docker.internal, not 127.0.0.1
# (which inside a container means the container itself); the browser uses
# 127.0.0.1 directly. And it reads the local anon/service-role keys straight
# from `supabase status`, so there's no manual copy-pasting into .env.
set -e
cd "$(dirname "$0")/.."

MODE="${1:-up}"
if [ "$MODE" != "up" ] && [ "$MODE" != "security" ]; then
  echo "Usage: $0 [up|security]" >&2
  exit 1
fi

if ! supabase status >/dev/null 2>&1; then
  echo "[local-up] local Supabase not running — starting it (first run pulls"
  echo "           images, can take a while)..."
  supabase start
fi

echo "[local-up] reading local Supabase keys..."
STATUS_ENV=$(supabase status -o env)
ANON_KEY=$(echo "$STATUS_ENV" | grep -E '^(ANON_KEY|PUBLISHABLE_KEY)=' | head -1 | cut -d= -f2- | tr -d '"')
SERVICE_ROLE_KEY=$(echo "$STATUS_ENV" | grep -E '^(SERVICE_ROLE_KEY|SECRET_KEY)=' | head -1 | cut -d= -f2- | tr -d '"')

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
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"

echo "[local-up] bringing up '$MODE' against local Supabase..."
if [ "$MODE" = "security" ]; then
  make security
else
  make up
fi

echo "[local-up] done. Open https://localhost:$( [ "$MODE" = "security" ] && echo 8443 || echo 3000 )"
