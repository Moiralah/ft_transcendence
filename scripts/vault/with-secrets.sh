#!/bin/sh
# Run a command with secrets fetched from Vault, held only in this process's
# environment (never written to a file). Used by `make up` (dev secrets).
#
#   scripts/vault/with-secrets.sh <dev|prod> -- <command> [args...]
#
# Env: VAULT_ADDR, VAULT_USER, VAULT_TOKEN_FILE (see lib.sh).
# Needs only curl and python3 (no Vault install on laptops).
set -e
ENVNAME=${1:?usage: with-secrets.sh <dev|prod> -- <command>}
shift
[ "$1" = "--" ] && shift
[ $# -gt 0 ] || { echo "usage: with-secrets.sh <dev|prod> -- <command>" >&2; exit 2; }
case "$ENVNAME" in dev|prod) ;; *) echo "environment must be dev or prod" >&2; exit 2;; esac
. "$(dirname "$0")/lib.sh"
SECRET_PATH="secret/data/family-tree/$ENVNAME"

vault_check
vault_login

# Fetch the secrets and export them into THIS process only.
vault_api GET "$SECRET_PATH"
case "$HTTP_STATUS" in
	200) ;;
	403) echo "[vault] Your Vault user may not read $ENVNAME secrets." >&2; exit 1;;
	404) echo "[vault] No secrets stored at $SECRET_PATH yet." >&2; exit 1;;
	*)   echo "[vault] Reading $SECRET_PATH failed (HTTP $HTTP_STATUS)." >&2; exit 1;;
esac
EXPORTS=$(printf '%s' "$VAULT_BODY" | python3 -c '
import json, re, shlex, sys
data = json.load(sys.stdin)["data"]["data"]
for k, v in data.items():
    if re.fullmatch(r"[A-Z_][A-Z0-9_]*", k):
        print(f"export {k}={shlex.quote(str(v))}")
')
eval "$EXPORTS"
echo "[vault] Loaded $(printf '%s\n' "$EXPORTS" | grep -c '^export') $ENVNAME secrets from Vault (in memory only)." >&2

exec "$@"
