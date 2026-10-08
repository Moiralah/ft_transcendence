#!/bin/sh
# ONE-TIME configuration of a freshly initialized and unsealed Vault, using the
# initial root token from init.sh's output file. At the end the root token is
# REVOKED: from then on the admin works through their own userpass login.
#
#   VAULT_CONTAINER=<name> scripts/vault/configure.sh <init-output-file> <passwords-output-file>
#
# Sets up:
#   - KV v2 secrets engine at secret/ with two paths:
#       secret/family-tree/prod   read by the production backend only
#       secret/family-tree/dev    read by teammates' `make up`
#   - audit log at /vault/logs/audit.log (every request recorded)
#   - policies: backend-prod (read prod), dev-read (read dev), admin
#   - AppRole "backend" (production backend's machine login, backend-prod)
#   - userpass users: tiara (admin); moira, jon, yiwei (dev-read)
#     with random initial passwords written to <passwords-output-file>
set -e
C=${VAULT_CONTAINER:-vault-rehearsal-vault-1}
INIT=${1:?usage: configure.sh <init-output-file> <passwords-output-file>}
PWOUT=${2:?usage: configure.sh <init-output-file> <passwords-output-file>}
[ -e "$PWOUT" ] && { echo "refusing to overwrite $PWOUT"; exit 1; }

ROOT=$(sed -n 's/.*"root_token": *"\([^"]*\)".*/\1/p' "$INIT")
[ -n "$ROOT" ] || { echo "no root_token in $INIT"; exit 1; }
v() { docker exec -e VAULT_TOKEN="$ROOT" "$C" vault "$@"; }
vin() { docker exec -i -e VAULT_TOKEN="$ROOT" "$C" vault "$@"; }

echo "[configure] secrets engine + audit log"
v secrets enable -path=secret -version=2 kv >/dev/null 2>&1 || echo "  (kv already enabled)"
v audit enable file file_path=/vault/logs/audit.log >/dev/null 2>&1 || echo "  (audit already enabled)"

echo "[configure] policies"
printf '%s\n' 'path "secret/data/family-tree/prod" { capabilities = ["read"] }' | vin policy write backend-prod - >/dev/null
printf '%s\n' 'path "secret/data/family-tree/dev" { capabilities = ["read"] }' | vin policy write dev-read - >/dev/null
vin policy write admin - >/dev/null <<'HCL'
# Manage secrets, users and the backend's AppRole; read the audit config.
path "secret/*"                  { capabilities = ["create", "read", "update", "delete", "list"] }
path "auth/userpass/users/*"     { capabilities = ["create", "read", "update", "delete", "list"] }
path "auth/approle/role/*"       { capabilities = ["create", "read", "update", "delete", "list"] }
path "sys/policies/acl/*"        { capabilities = ["create", "read", "update", "delete", "list"] }
path "sys/audit"                 { capabilities = ["read", "sudo"] }
path "sys/mounts"                { capabilities = ["read"] }
HCL

echo "[configure] AppRole for the production backend"
v auth enable approle >/dev/null 2>&1 || echo "  (approle already enabled)"
v write auth/approle/role/backend token_policies=backend-prod token_ttl=1h token_max_ttl=4h secret_id_ttl=0 >/dev/null

echo "[configure] userpass logins"
v auth enable userpass >/dev/null 2>&1 || echo "  (userpass already enabled)"
umask 077
: > "$PWOUT"; chmod 600 "$PWOUT"
for u in tiara moira jon yiwei; do
	pw=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)
	# admin alone: adding dev-read would REMOVE write on the dev path, because
	# Vault applies the most specific matching rule (exact path beats secret/*).
	pol=dev-read; [ "$u" = tiara ] && pol=admin
	v write "auth/userpass/users/$u" password="$pw" token_policies="$pol" token_ttl=12h token_max_ttl=24h >/dev/null
	echo "$u $pw" >> "$PWOUT"
done
echo "  initial passwords written to $PWOUT (owner-only); each person should change theirs"

echo "[configure] revoking the initial root token"
v token revoke -self >/dev/null
echo "[configure] done. Root token revoked; admin = userpass 'tiara'."
