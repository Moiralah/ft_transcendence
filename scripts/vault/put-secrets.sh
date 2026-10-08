#!/bin/sh
# Admin only: store secrets in Vault from an env file (KEY=VALUE lines), e.g.
# moving production's .env values in once, or rotating one later.
#
#   VAULT_USER=tiara scripts/vault/put-secrets.sh <dev|prod> <env-file> [KEY ...]
#
# Without KEYs, stores the backend's secret set (DEFAULT_KEYS below). Replaces
# what is at secret/family-tree/<dev|prod> (Vault keeps the old version, see
# `vault kv rollback`). Prints key names only, never values. Afterwards the
# secret lines can be removed from that .env: the backend reads them from Vault.
set -e
ENVNAME=${1:?usage: put-secrets.sh <dev|prod> <env-file> [KEY ...]}
FILE=${2:?usage: put-secrets.sh <dev|prod> <env-file> [KEY ...]}
shift 2
case "$ENVNAME" in dev|prod) ;; *) echo "environment must be dev or prod" >&2; exit 2;; esac
[ -r "$FILE" ] || { echo "can't read $FILE" >&2; exit 1; }
DEFAULT_KEYS="JWT_SECRET SUPABASE_SERVICE_ROLE_KEY DATABASE_URL DIRECT_URL SUPABASE_AUTH_URL SMTP_PASS"
KEYS=${*:-$DEFAULT_KEYS}
. "$(dirname "$0")/lib.sh"

vault_check
vault_login

# Same parsing rules as scripts/vault-init.sh: CRLF stripped, last non-empty
# line wins, SMTP_PASS loses Google's spaces, and loopback DB/auth URLs are
# rewritten to host.docker.internal (only matters for local Supabase).
BODY=$(KEYS="$KEYS" python3 - "$FILE" <<'PY'
import json, os, re, sys
vals = {}
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.rstrip("\r\n")
    m = re.match(r"\s*([A-Z_][A-Z0-9_]*)=(.*)$", line)
    if m and m.group(2) != "":
        vals[m.group(1)] = m.group(2).strip().strip('"').strip("'")
out, missing = {}, []
for k in os.environ["KEYS"].split():
    if k not in vals:
        missing.append(k); continue
    v = vals[k]
    if k == "SMTP_PASS":
        v = v.replace(" ", "")
    if k in ("DATABASE_URL", "DIRECT_URL", "SUPABASE_AUTH_URL"):
        v = re.sub(r"://([^/@]*@)?(127\.0\.0\.1|localhost)([:/])", r"://\1host.docker.internal\3", v)
    out[k] = v
if missing:
    print("not in file (skipped): " + " ".join(missing), file=sys.stderr)
print(json.dumps({"data": out}))
PY
)
NAMES=$(printf '%s' "$BODY" | json "' '.join(d['data'])")
[ -n "$NAMES" ] || { echo "[vault] nothing to store" >&2; exit 1; }
vault_api POST "secret/data/family-tree/$ENVNAME" "$BODY"
BODY=""
case "$HTTP_STATUS" in
	200|204) echo "[vault] stored at secret/family-tree/$ENVNAME: $NAMES";;
	403) echo "[vault] '$VAULT_USER' may not write $ENVNAME secrets (admin only)." >&2; exit 1;;
	*)   echo "[vault] write failed (HTTP $HTTP_STATUS)" >&2; exit 1;;
esac
