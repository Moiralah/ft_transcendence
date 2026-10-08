#!/bin/sh
# The one correct way to bring the production stack up — whether after a fresh
# deploy, a VM reboot, or just recovering from something breaking. `make prod`
# runs this on the server; `make deploy` runs it there from your laptop.
#
# Exists because every production incident so far in this project traces back
# to the same root cause: some command in the sequence used a different subset
# of the compose files than the others, silently reverting backend to
# the dev target/bind-mount (docker-compose.yml alone) instead of the real
# prod build (needs docker-compose.prod.yml too). This script always uses the
# same file set, everywhere, so that class of bug can't happen again:
#   - docker-compose.yml + docker-compose-security.yml + docker-compose.prod.yml
#   - + docker-compose.vault-server.yml once vault/backend-approle.env exists
#     (server-mode Vault; see scripts/vault/backend-creds.sh). Without it, the
#     old dev-mode Vault refilled from .env by vault-init.sh, as before.
#   - + docker-compose.home.yml if present (solsys only, untracked: publishes
#     the WAFs and Vault on the WireGuard address only). Always last.
#
# Usage: ./scripts/prod-up.sh
# Safe to re-run any time — every step here is idempotent.
set -e
cd "$(dirname "$0")/.."

COMPOSE_FILES="-f docker-compose.yml -f docker-compose-security.yml -f docker-compose.prod.yml"
APPROLE_FILE=vault/backend-approle.env
SERVER_VAULT=""
if [ -f "$APPROLE_FILE" ]; then
  SERVER_VAULT=1
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.vault-server.yml"
fi
CHECK_HOST=localhost
if [ -f docker-compose.home.yml ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.home.yml"
  CHECK_HOST=10.8.0.1   # the WAFs are only published there on solsys
fi
echo "[prod-up] compose files:$(echo "$COMPOSE_FILES" | sed 's/-f //g')"

echo "[prod-up] building images (source may have changed since the last deploy —"
echo "          without --build, 'up -d' silently reuses whatever image already"
echo "          exists and only recreates containers, which looks identical to a"
echo "          real deploy in the logs but ships no new code at all)..."
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES build

if [ -n "$SERVER_VAULT" ]; then
  # Server-mode Vault keeps its data, so there is nothing to re-write here; it
  # only has to be unsealed before the backend can log in and read its secrets.
  echo "[prod-up] starting Vault (server mode)..."
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES up -d vault
  i=0
  until curl -s -m 2 http://127.0.0.1:8200/v1/sys/seal-status >/dev/null 2>&1; do
    i=$((i + 1)); [ $i -ge 30 ] && { echo "[prod-up] Vault didn't answer within 30s."; exit 1; }
    sleep 1
  done
  VAULT_ADDR=http://127.0.0.1:8200 \
  VAULT_LOCAL_SHARE_FILE="${VAULT_LOCAL_SHARE_FILE:-$HOME/.ft-vault/unseal-share}" \
    ./scripts/vault/unseal.sh --machine-only
  if curl -s http://127.0.0.1:8200/v1/sys/seal-status | grep -q '"sealed":true'; then
    echo "[prod-up] Vault is SEALED, so the backend can't get its secrets. Not restarting"
    echo "          anything else. One more share holder runs 'make unseal', then run"
    echo "          this again ('make prod' here, or 'make deploy' from a laptop)."
    exit 1
  fi

  echo "[prod-up] bringing up all services (backend logs in with its AppRole)..."
  set -a; . "./$APPROLE_FILE"; set +a
  # shellcheck disable=SC2086
  VAULT_ADDR=http://vault:8200 docker compose $COMPOSE_FILES up -d
else
  echo "[prod-up] bringing up all services..."
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES up -d

  echo "[prod-up] re-bootstrapping Vault (dev-mode secrets don't survive a Vault restart)..."
  # vault-init.sh's own internal restart of backend needs to see the same file
  # set, or it silently drops docker-compose.prod.yml and backend ends up with
  # the dev bind-mount shadowing its own /app/dist again.
  COMPOSE_FILES="$COMPOSE_FILES" ./scripts/vault-init.sh
fi

echo "[prod-up] restarting WAF containers (nginx caches upstream IPs at its own"
echo "          startup — anything above that recreated backend/frontend just"
echo "          gave them new IPs the WAF doesn't know about yet)..."
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES restart waf-backend waf-frontend

echo "[prod-up] verifying (NestJS takes ~10s to fully boot after a restart, so"
echo "          retry for up to 60s instead of checking once)..."
i=0
while [ $i -lt 20 ]; do
  FRONTEND_CODE=$(curl -sk -o /dev/null -w '%{http_code}' https://$CHECK_HOST:8443/login || echo "000")
  BACKEND_CODE=$(curl -sk -o /dev/null -w '%{http_code}' https://$CHECK_HOST:9443/api/trees/my-trees || echo "000")
  if [ "$FRONTEND_CODE" = "200" ] && [ "$BACKEND_CODE" = "401" ]; then
    break
  fi
  i=$((i + 1))
  sleep 3
done
echo "[prod-up] frontend :8443/login -> $FRONTEND_CODE (want 200)"
echo "[prod-up] backend  :9443/api/trees/my-trees -> $BACKEND_CODE (want 401 — reaches the app, just unauth'd)"

if [ "$FRONTEND_CODE" != "200" ] || [ "$BACKEND_CODE" != "401" ]; then
  echo "[prod-up] WARNING: still not healthy after 60s of retries. Check:"
  echo "  docker compose$(echo "$COMPOSE_FILES") ps"
  echo "  docker compose$(echo "$COMPOSE_FILES") logs backend waf-backend"
  exit 1
fi

echo "[prod-up] done, healthy."
