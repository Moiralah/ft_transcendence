# Shared by the scripts/vault/*.sh scripts that talk to Vault over HTTP (source
# it, don't run it). Needs only curl and python3.
#
#   VAULT_ADDR        Vault to use. Unset (the normal case): your own SSH tunnel
#                     to solsys's Vault is opened for you, see vault_tunnel below.
#                     The local rehearsal uses http://127.0.0.1:18200.
#   VAULT_SSH         SSH login for the tunnel (default $VAULT_USER@ft.natscho.my:
#                     your own account on the GCP proxy, which may only forward
#                     to Vault; same name as your Vault login)
#   VAULT_SSH_KEY     your private key for it (default: ssh's usual keys)
#   VAULT_TUNNEL_PORT local end of the tunnel (default 18201)
#   VAULT_USER        your Vault username (asked for if unset)
#   VAULT_TOKEN_FILE  where the day's login token is kept (default ~/.vault-token,
#                     owner-only; the token expires on its own after 12-24 h)

VAULT_TUNNEL_PORT=${VAULT_TUNNEL_PORT:-18201}
if [ -z "$VAULT_ADDR" ]; then
	VAULT_ADDR="http://127.0.0.1:$VAULT_TUNNEL_PORT"
	VAULT_VIA_TUNNEL=1
fi
TOKEN_FILE=${VAULT_TOKEN_FILE:-$HOME/.vault-token}

json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

ask_user() {
	if [ -z "$VAULT_USER" ]; then printf 'Your login (Vault and tunnel): ' >&2; read -r VAULT_USER; fi
}

# Opens your SSH tunnel to Vault unless one is already up. It goes to the GCP
# proxy with your own key and account; it may forward to 10.8.0.1:8200 (Vault on
# solsys, over WireGuard) and nothing else: no shell, no other ports. The tunnel
# stays open in the background and is reused by the next run.
vault_tunnel() {
	[ "$VAULT_VIA_TUNNEL" = 1 ] || return 0
	curl -s -o /dev/null -m 3 "$VAULT_ADDR/v1/sys/health" && return 0
	if [ -z "$VAULT_SSH" ]; then
		ask_user
		VAULT_SSH="$VAULT_USER@ft.natscho.my"
	fi
	echo "[vault] opening your SSH tunnel to Vault ($VAULT_SSH)..." >&2
	ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o StrictHostKeyChecking=accept-new \
		${VAULT_SSH_KEY:+-i "$VAULT_SSH_KEY"} \
		-L "127.0.0.1:$VAULT_TUNNEL_PORT:10.8.0.1:8200" "$VAULT_SSH" \
		|| { echo "[vault] SSH tunnel failed. Has Tiara added your SSH key? (vault/README.md)" >&2; exit 1; }
}

# Is Vault reachable, and unsealed? Exits with a readable message if not.
vault_check() {
	vault_tunnel
	code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$VAULT_ADDR/v1/sys/health" || true)
	case "$code" in
		200|429|472|473) ;;
		503) echo "[vault] Vault at $VAULT_ADDR is SEALED. Two share holders need to run 'make unseal'." >&2; exit 1;;
		000) echo "[vault] Can't reach Vault at $VAULT_ADDR (tunnel up, but no answer from solsys)." >&2; exit 1;;
		*)   echo "[vault] Unexpected Vault health status $code from $VAULT_ADDR." >&2; exit 1;;
	esac
}

# Sets TOKEN: reuses today's token if it's still valid, otherwise logs in.
vault_login() {
	TOKEN=""
	if [ -r "$TOKEN_FILE" ]; then
		TOKEN=$(cat "$TOKEN_FILE")
		ok=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -H "X-Vault-Token: $TOKEN" "$VAULT_ADDR/v1/auth/token/lookup-self" || true)
		[ "$ok" = 200 ] || TOKEN=""
	fi
	[ -n "$TOKEN" ] && return 0
	ask_user
	printf 'Vault password for %s (input hidden): ' "$VAULT_USER" >&2
	stty -echo 2>/dev/null || true
	read -r VAULT_PW || true   # keeps a last line without newline
	stty echo 2>/dev/null || true; echo >&2
	TOKEN=$(printf '{"password":%s}' "$(printf '%s' "$VAULT_PW" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
		| curl -s -m 10 -X POST --data @- "$VAULT_ADDR/v1/auth/userpass/login/$VAULT_USER" \
		| json "(d.get('auth') or {}).get('client_token','')" 2>/dev/null || true)
	VAULT_PW=""
	[ -n "$TOKEN" ] || { echo "[vault] Login failed for '$VAULT_USER'." >&2; exit 1; }
	( umask 077; printf '%s' "$TOKEN" > "$TOKEN_FILE" )
	echo "[vault] Logged in as $VAULT_USER (token saved to $TOKEN_FILE, owner-only)." >&2
}

# vault_api METHOD PATH [JSON-BODY]: sets VAULT_BODY and HTTP_STATUS.
# (Call it directly, not inside $(...): a subshell would lose both.)
vault_api() {
	_resp=$(curl -s -m 10 -w '\n%{http_code}' -X "$1" -H "X-Vault-Token: $TOKEN" \
		${3:+-H "Content-Type: application/json" --data "$3"} "$VAULT_ADDR/v1/$2")
	HTTP_STATUS=$(printf '%s' "$_resp" | tail -n1)
	VAULT_BODY=$(printf '%s' "$_resp" | sed '$d')
}
