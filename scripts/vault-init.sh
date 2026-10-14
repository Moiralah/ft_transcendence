#!/bin/sh
# Bootstraps the dev-mode Vault instance: writes the backend's secrets,
# sets up AppRole auth scoped to read-only on exactly that path, then
# (re)starts the backend/frontend containers with the AppRole credentials
# (and the usual host.docker.internal DB overrides) so they actually pick
# it up.
#
# Runs every time because Vault dev mode is IN-MEMORY — all of this is
# wiped on every `vault` container restart, there is nothing to be
# idempotent about. Not for production: see docker-compose-security.yml's
# comment on the vault service for what a real deployment needs instead.
set -e

VAULT_ADDR="http://127.0.0.1:8200"
VAULT_TOKEN="dev-only-root-token"
SECRET_PATH="secret/data/family-tree/backend"

cd "$(dirname "$0")/.."

echo "[vault-init] waiting for Vault..."
for i in $(seq 1 30); do
  if curl -sf "$VAULT_ADDR/v1/sys/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "[vault-init] reading secret values..."
# Each value comes from the environment when it is set there, otherwise from
# .env. `make up` runs this under scripts/vault/with-secrets.sh, which
# exports the dev secrets from the solsys Vault and leaves no secrets in .env
# (there may be no .env at all); local-up.sh exports the local Supabase
# database, auth URL and service key, so a .env that points at the cloud
# project can't quietly connect a "local" run to it. On the server nothing is
# exported and .env is used, as before.
# .env has CRLF line endings — cut leaves the trailing \r in the value,
# which breaks Vault's JSON parsing later (same CRLF class of bug that's
# bitten this project before). Strip it explicitly.
# Values may also be wrapped in quotes (KEY="value", as the README shows):
# strip one pair, or the quotes end up inside the JSON below and the write fails.
env_value() {
  [ -f .env ] || return 0
  grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '\r' \
    | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}
secret_value() {
  eval "_v=\${$1:-}"
  if [ -n "$_v" ]; then printf '%s' "$_v"; else env_value "$1"; fi
}
# Names only, never values.
FROM_ENVIRONMENT=""
for name in JWT_SECRET SUPABASE_SERVICE_ROLE_KEY DATABASE_URL DIRECT_URL SUPABASE_AUTH_URL SMTP_PASS; do
  eval "_v=\${$name:-}"
  [ -n "$_v" ] && FROM_ENVIRONMENT="$FROM_ENVIRONMENT $name"
done
echo "[vault-init] from the environment:${FROM_ENVIRONMENT:- (none)}; the rest from .env"
JWT_SECRET=$(secret_value JWT_SECRET)
SUPABASE_SERVICE_ROLE_KEY=$(secret_value SUPABASE_SERVICE_ROLE_KEY)
DATABASE_URL_RAW=$(secret_value DATABASE_URL)
DIRECT_URL_RAW=$(secret_value DIRECT_URL)
SUPABASE_AUTH_URL_RAW=$(secret_value SUPABASE_AUTH_URL)
# Optional: Gmail App Password for the feedback form. Google shows it in
# groups of four with spaces; strip those. Empty is fine (feedback then
# answers 503 instead of sending).
# Last non-empty line only: a duplicate or empty SMTP_PASS= line used to
# turn this into a multi-line value, the JSON below became invalid, and the
# Vault write failed silently, keeping the old (empty) secret.
SMTP_PASS=$(secret_value SMTP_PASS | tr -d ' "')
# Stop here rather than start a backend that can't sign tokens or reach the DB.
for name in JWT_SECRET SUPABASE_SERVICE_ROLE_KEY DATABASE_URL_RAW DIRECT_URL_RAW SUPABASE_AUTH_URL_RAW; do
  eval "_v=\${$name:-}"
  if [ -z "$_v" ]; then
    echo "[vault-init] ERROR: ${name%_RAW} is empty (not in the environment or .env)." >&2
    exit 1
  fi
done
# In LOCAL dev, Supabase/Postgres run on the HOST (127.0.0.1/localhost),
# which inside the backend's Docker container means the container itself,
# not the host — rewrite to host.docker.internal. See README "Running
# Supabase Locally". In PRODUCTION, .env already points at a real,
# internet-reachable Supabase project, so this must NOT rewrite it — doing
# so previously sent the deployed backend to host.docker.internal, which
# doesn't even resolve in that container, silently breaking every DB call
# and every token verification (found 2026-09-23, see progress_log.md).
# Only touch values that actually are a loopback address; pass anything
# else through unchanged.
rewrite_loopback() {
  echo "$1" | sed -E 's#://(127\.0\.0\.1|localhost)([:/])#://host.docker.internal\2#'
}
DATABASE_URL_DOCKER=$(rewrite_loopback "$DATABASE_URL_RAW")
DIRECT_URL_DOCKER=$(rewrite_loopback "$DIRECT_URL_RAW")
SUPABASE_AUTH_URL_DOCKER=$(rewrite_loopback "$SUPABASE_AUTH_URL_RAW")

echo "[vault-init] writing secret/data/family-tree/backend..."
# JSON built by python3 (escapes any character), and the HTTP status checked:
# a failed write used to pass silently and the backend then crashed on a 404.
SECRET_JSON=$(JWT_SECRET="$JWT_SECRET" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  DATABASE_URL="$DATABASE_URL_DOCKER" DIRECT_URL="$DIRECT_URL_DOCKER" \
  SUPABASE_AUTH_URL="$SUPABASE_AUTH_URL_DOCKER" SMTP_PASS="$SMTP_PASS" python3 -c '
import json, os
keys = ["JWT_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "DIRECT_URL", "SUPABASE_AUTH_URL", "SMTP_PASS"]
print(json.dumps({"data": {k: os.environ[k] for k in keys}}))')
WRITE_STATUS=$(printf '%s' "$SECRET_JSON" | curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H "X-Vault-Token: $VAULT_TOKEN" -H "Content-Type: application/json" --data @- \
  "$VAULT_ADDR/v1/$SECRET_PATH")
if [ "$WRITE_STATUS" != "200" ] && [ "$WRITE_STATUS" != "204" ]; then
  echo "[vault-init] ERROR: writing the secrets to Vault failed (HTTP $WRITE_STATUS)." >&2
  exit 1
fi

echo "[vault-init] enabling approle auth (ok if already enabled)..."
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"approle"}' "$VAULT_ADDR/v1/sys/auth/approle" >/dev/null 2>&1 || true

echo "[vault-init] writing read-only policy..."
curl -s -X PUT -H "X-Vault-Token: $VAULT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"policy\":\"path \\\"$SECRET_PATH\\\" {\\n  capabilities = [\\\"read\\\"]\\n}\\n\"}" \
  "$VAULT_ADDR/v1/sys/policies/acl/backend-readonly" >/dev/null

echo "[vault-init] creating backend approle..."
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" -H "Content-Type: application/json" \
  -d '{"token_policies":"backend-readonly","token_ttl":"1h","token_max_ttl":"4h","secret_id_ttl":"0"}' \
  "$VAULT_ADDR/v1/auth/approle/role/backend" >/dev/null

ROLE_ID=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/auth/approle/role/backend/role-id" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['role_id'])")
SECRET_ID_JSON=$(curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/auth/approle/role/backend/secret-id")
SECRET_ID=$(echo "$SECRET_ID_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['secret_id'])")
NEW_ACCESSOR=$(echo "$SECRET_ID_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['secret_id_accessor'])")

# Revoke every older secret_id for this role. secret_id_ttl is 0 (they never
# expire, so the backend can log in again after any restart), so without this
# each run of this script left another valid credential behind (21 had piled up
# by 2026-10-06). Only the one the backend is about to start with stays valid.
echo "[vault-init] revoking older backend secret_ids..."
for accessor in $(curl -s -X LIST -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/auth/approle/role/backend/secret-id" \
  | python3 -c "import json,sys; print(' '.join(json.load(sys.stdin).get('data', {}).get('keys', [])))" 2>/dev/null); do
  [ "$accessor" = "$NEW_ACCESSOR" ] && continue
  curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" -H "Content-Type: application/json" \
    -d "{\"secret_id_accessor\":\"$accessor\"}" \
    "$VAULT_ADDR/v1/auth/approle/role/backend/secret-id-accessor/destroy" >/dev/null
done

# Overridable so a production deploy can add docker-compose.prod.yml — without this,
# this restart would recreate `backend` using only the base + security files, silently
# reverting it from the `prod` build target back to `dev` (found while testing the
# production compose locally: the container's CMD was still `node dist/main.js` only
# because this script errored out *before* reaching this line that run).
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose-security.yml}"

echo "[vault-init] starting backend with AppRole credentials..."
DATABASE_URL="$DATABASE_URL_DOCKER" \
DIRECT_URL="$DIRECT_URL_DOCKER" \
SUPABASE_AUTH_URL="$SUPABASE_AUTH_URL_DOCKER" \
VAULT_ADDR="http://vault:8200" \
VAULT_ROLE_ID="$ROLE_ID" \
VAULT_SECRET_ID="$SECRET_ID" \
  docker compose $COMPOSE_FILES up -d backend

echo "[vault-init] done."
