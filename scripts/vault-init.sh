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

echo "[vault-init] reading secret values from .env..."
# .env has CRLF line endings — cut leaves the trailing \r in the value,
# which breaks Vault's JSON parsing later (same CRLF class of bug that's
# bitten this project before). Strip it explicitly.
JWT_SECRET=$(grep -E '^JWT_SECRET=' .env | cut -d= -f2- | tr -d '\r')
SUPABASE_SERVICE_ROLE_KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d= -f2- | tr -d '\r')
# Container-side values, not the host-side ones in .env — the backend
# reads these from inside Docker, where 127.0.0.1 means the container
# itself, not the host. See README "Running Supabase Locally".
DATABASE_URL_DOCKER="postgresql://postgres:postgres@host.docker.internal:54322/postgres"
DIRECT_URL_DOCKER="postgresql://postgres:postgres@host.docker.internal:54322/postgres"
SUPABASE_AUTH_URL_DOCKER="http://host.docker.internal:54321"

echo "[vault-init] writing secret/data/family-tree/backend..."
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"data\":{\"JWT_SECRET\":\"$JWT_SECRET\",\"SUPABASE_SERVICE_ROLE_KEY\":\"$SUPABASE_SERVICE_ROLE_KEY\",\"DATABASE_URL\":\"$DATABASE_URL_DOCKER\",\"DIRECT_URL\":\"$DIRECT_URL_DOCKER\",\"SUPABASE_AUTH_URL\":\"$SUPABASE_AUTH_URL_DOCKER\"}}" \
  "$VAULT_ADDR/v1/$SECRET_PATH" >/dev/null

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
SECRET_ID=$(curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/auth/approle/role/backend/secret-id" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['secret_id'])")

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
