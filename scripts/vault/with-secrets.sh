#!/bin/sh
# Run a command with secrets fetched from Vault, held only in this process's
# environment (never written to a file). Used by `make up` (dev) and
# `make prod` (prod).
#
#   scripts/vault/with-secrets.sh <dev|prod> -- <command> [args...]
#
# Env:
#   VAULT_ADDR        Vault to use (default: http://10.8.0.1:8200, solsys over
#                     WireGuard; the local rehearsal uses http://127.0.0.1:18200)
#   VAULT_USER        your Vault username (asked for if unset)
#   VAULT_TOKEN_FILE  where the day's login token is kept (default ~/.vault-token,
#                     owner-only; the token expires on its own after 12-24 h)
#
# Needs only curl and python3 (no Vault install on laptops).
set -e
ENVNAME=${1:?usage: with-secrets.sh <dev|prod> -- <command>}
shift
[ "$1" = "--" ] && shift
[ $# -gt 0 ] || { echo "usage: with-secrets.sh <dev|prod> -- <command>" >&2; exit 2; }
case "$ENVNAME" in dev|prod) ;; *) echo "environment must be dev or prod" >&2; exit 2;; esac

VAULT_ADDR=${VAULT_ADDR:-http://10.8.0.1:8200}
TOKEN_FILE=${VAULT_TOKEN_FILE:-$HOME/.vault-token}
SECRET_PATH="secret/data/family-tree/$ENVNAME"

json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

# 1. Is Vault reachable, and unsealed?
code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$VAULT_ADDR/v1/sys/health" || true)
case "$code" in
	200|429|472|473) ;;
	503) echo "[vault] Vault at $VAULT_ADDR is SEALED. A share holder needs to run 'make unseal' on solsys." >&2; exit 1;;
	000) echo "[vault] Can't reach Vault at $VAULT_ADDR. Is WireGuard on?" >&2; exit 1;;
	*)   echo "[vault] Unexpected Vault health status $code from $VAULT_ADDR." >&2; exit 1;;
esac

# 2. Reuse today's token if it's still valid, otherwise log in.
TOKEN=""
if [ -r "$TOKEN_FILE" ]; then
	TOKEN=$(cat "$TOKEN_FILE")
	ok=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -H "X-Vault-Token: $TOKEN" "$VAULT_ADDR/v1/auth/token/lookup-self" || true)
	[ "$ok" = 200 ] || TOKEN=""
fi
if [ -z "$TOKEN" ]; then
	if [ -z "$VAULT_USER" ]; then printf 'Vault username: ' >&2; read -r VAULT_USER; fi
	printf 'Vault password for %s (input hidden): ' "$VAULT_USER" >&2
	stty -echo 2>/dev/null || true
	read -r VAULT_PW || VAULT_PW=""
	stty echo 2>/dev/null || true; echo >&2
	TOKEN=$(printf '{"password":%s}' "$(printf '%s' "$VAULT_PW" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
		| curl -s -m 10 -X POST --data @- "$VAULT_ADDR/v1/auth/userpass/login/$VAULT_USER" \
		| json "(d.get('auth') or {}).get('client_token','')" 2>/dev/null || true)
	VAULT_PW=""
	[ -n "$TOKEN" ] || { echo "[vault] Login failed for '$VAULT_USER'." >&2; exit 1; }
	( umask 077; printf '%s' "$TOKEN" > "$TOKEN_FILE" )
	echo "[vault] Logged in as $VAULT_USER (token saved to $TOKEN_FILE, owner-only)." >&2
fi

# 3. Fetch the secrets and export them into THIS process only.
RESP=$(curl -s -m 10 -w '\n%{http_code}' -H "X-Vault-Token: $TOKEN" "$VAULT_ADDR/v1/$SECRET_PATH")
STATUS=$(printf '%s' "$RESP" | tail -n1)
BODY=$(printf '%s' "$RESP" | sed '$d')
case "$STATUS" in
	200) ;;
	403) echo "[vault] Your Vault user may not read $ENVNAME secrets." >&2; exit 1;;
	404) echo "[vault] No secrets stored at $SECRET_PATH yet." >&2; exit 1;;
	*)   echo "[vault] Reading $SECRET_PATH failed (HTTP $STATUS)." >&2; exit 1;;
esac
EXPORTS=$(printf '%s' "$BODY" | python3 -c '
import json, re, shlex, sys
data = json.load(sys.stdin)["data"]["data"]
for k, v in data.items():
    if re.fullmatch(r"[A-Z_][A-Z0-9_]*", k):
        print(f"export {k}={shlex.quote(str(v))}")
')
eval "$EXPORTS"
echo "[vault] Loaded $(printf '%s\n' "$EXPORTS" | grep -c '^export') $ENVNAME secrets from Vault (in memory only)." >&2

# 4. Run the command with them.
exec "$@"
