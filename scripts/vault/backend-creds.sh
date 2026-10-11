#!/bin/sh
# Admin only, on the production machine: give the backend its Vault login
# (AppRole "backend", which may read secret/family-tree/prod and nothing else).
#
#   VAULT_ADDR=http://127.0.0.1:8200 VAULT_USER=tiara scripts/vault/backend-creds.sh
#
# Writes vault/backend-approle.env (owner-only, gitignored). Its presence is
# what switches scripts/prod-up.sh to the server-mode Vault. Re-run to rotate:
# every older secret_id is revoked, so only the new file works.
set -e
cd "$(dirname "$0")/../.."
OUT=vault/backend-approle.env
. scripts/vault/lib.sh

vault_check
vault_login

vault_api GET auth/approle/role/backend/role-id
[ "$HTTP_STATUS" = 200 ] || { echo "[vault] can't read the backend AppRole (HTTP $HTTP_STATUS); admin only." >&2; exit 1; }
ROLE_ID=$(printf '%s' "$VAULT_BODY" | json "d['data']['role_id']")
vault_api POST auth/approle/role/backend/secret-id '{}'
SECRET_ID=$(printf '%s' "$VAULT_BODY" | json "d['data']['secret_id']")
KEEP=$(printf '%s' "$VAULT_BODY" | json "d['data']['secret_id_accessor']")
VAULT_BODY=""

revoked=0
vault_api LIST auth/approle/role/backend/secret-id
for a in $(printf '%s' "$VAULT_BODY" | json "' '.join(d.get('data', {}).get('keys', []))" 2>/dev/null); do
	[ "$a" = "$KEEP" ] && continue
	vault_api POST auth/approle/role/backend/secret-id-accessor/destroy "{\"secret_id_accessor\":\"$a\"}"
	revoked=$((revoked + 1))
done

( umask 077; printf 'VAULT_ROLE_ID=%s\nVAULT_SECRET_ID=%s\n' "$ROLE_ID" "$SECRET_ID" > "$OUT" )
SECRET_ID=""
echo "[vault] backend login written to $OUT (owner-only); $revoked older secret_id(s) revoked."
echo "        Restart the backend to use it: make prod"
