#!/bin/sh
# Log in to Vault and nothing else: opens your SSH tunnel, asks for your
# password and keeps the token (lib.sh), so the next `make up`/`make production`
# doesn't prompt. If today's token is still valid it just says so.
#
#   [VAULT_USER=<login>] scripts/vault/login.sh
set -e
. "$(dirname "$0")/lib.sh"

vault_check
vault_login
vault_api GET auth/token/lookup-self
who=$(printf '%s' "$VAULT_BODY" | json "(d['data'].get('meta') or {}).get('username','')" 2>/dev/null || true)
ttl=$(printf '%s' "$VAULT_BODY" | json "int(d['data']['ttl'])" 2>/dev/null || true)
case "$ttl" in
	''|*[!0-9]*) echo "[vault] Logged in as ${who:-$VAULT_USER}." >&2;;
	*) echo "[vault] Logged in as ${who:-$VAULT_USER}; token good for another $((ttl / 3600))h $((ttl % 3600 / 60))m." >&2;;
esac
