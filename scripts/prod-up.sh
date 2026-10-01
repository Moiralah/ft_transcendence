#!/bin/sh
# The one correct way to bring the production stack up — whether after a fresh
# deploy, a VM reboot, or just recovering from something breaking.
#
# Exists because every production incident so far in this project traces back
# to the same root cause: some command in the sequence used a different subset
# of the three compose files than the others, silently reverting backend to
# the dev target/bind-mount (docker-compose.yml alone) instead of the real
# prod build (needs docker-compose.prod.yml too). This script always uses all
# three, everywhere, so that class of bug can't happen again.
#
# Usage: ./scripts/prod-up.sh
# Safe to re-run any time — every step here is idempotent.
set -e
cd "$(dirname "$0")/.."

COMPOSE_FILES="-f docker-compose.yml -f docker-compose-security.yml -f docker-compose.prod.yml"

echo "[prod-up] bringing up all services..."
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d

echo "[prod-up] re-bootstrapping Vault (dev-mode secrets don't survive a Vault restart)..."
# vault-init.sh's own internal restart of backend needs to see the same file
# set, or it silently drops docker-compose.prod.yml and backend ends up with
# the dev bind-mount shadowing its own /app/dist again.
COMPOSE_FILES="$COMPOSE_FILES" ./scripts/vault-init.sh

echo "[prod-up] restarting WAF containers (nginx caches upstream IPs at its own"
echo "          startup — anything above that recreated backend/frontend just"
echo "          gave them new IPs the WAF doesn't know about yet)..."
docker restart ft_transcendence-waf-backend-1 ft_transcendence-waf-frontend-1

echo "[prod-up] verifying (NestJS takes ~10s to fully boot after a restart, so"
echo "          retry for up to 30s instead of checking once)..."
i=0
while [ $i -lt 10 ]; do
  FRONTEND_CODE=$(curl -sk -o /dev/null -w '%{http_code}' https://localhost:8443/login || echo "000")
  BACKEND_CODE=$(curl -sk -o /dev/null -w '%{http_code}' https://localhost:9443/api/trees/my-trees || echo "000")
  if [ "$FRONTEND_CODE" = "200" ] && [ "$BACKEND_CODE" = "401" ]; then
    break
  fi
  i=$((i + 1))
  sleep 3
done
echo "[prod-up] frontend :8443/login -> $FRONTEND_CODE (want 200)"
echo "[prod-up] backend  :9443/api/trees/my-trees -> $BACKEND_CODE (want 401 — reaches the app, just unauth'd)"

if [ "$FRONTEND_CODE" != "200" ] || [ "$BACKEND_CODE" != "401" ]; then
  echo "[prod-up] WARNING: still not healthy after 30s of retries. Check:"
  echo "  docker ps"
  echo "  docker logs ft_transcendence-backend-1"
  echo "  docker logs ft_transcendence-waf-backend-1"
  exit 1
fi

echo "[prod-up] done, healthy."
