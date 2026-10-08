#!/bin/sh
# Unseal Vault after a (re)start. Needs 2 of the 5 shares. Works from any
# share holder's laptop over WireGuard (`make unseal`), no SSH to solsys needed.
#
#   [VAULT_ADDR=<url>] [VAULT_LOCAL_SHARE_FILE=<file>] scripts/vault/unseal.sh [--machine-only]
#
# If VAULT_LOCAL_SHARE_FILE points at this machine's own share (solsys keeps
# one, owner-only, outside Vault's data), it is used first, so one person
# typing their share is enough. --machine-only applies just that share and
# exits (what scripts/prod-up.sh does). Typed shares are never echoed or stored.
set -e
. "$(dirname "$0")/lib.sh"

status() { curl -s -m 5 "$VAULT_ADDR/v1/sys/seal-status" || true; }
sealed() { status | grep -q '"sealed":true'; }
progress() { status | json "f\"{d['progress']}/{d['t']}\""; }
unseal() {
	printf '{"key":%s}' "$(printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')" \
		| curl -s -m 10 -o /dev/null -w '%{http_code}' -X PUT --data @- "$VAULT_ADDR/v1/sys/unseal"
}

[ -n "$(status)" ] || { echo "Can't reach Vault at $VAULT_ADDR. Is WireGuard on?"; exit 1; }
if ! sealed; then echo "Vault is already unsealed."; exit 0; fi

if [ -n "$VAULT_LOCAL_SHARE_FILE" ] && [ -r "$VAULT_LOCAL_SHARE_FILE" ]; then
	[ "$(unseal "$(cat "$VAULT_LOCAL_SHARE_FILE")")" = 200 ] || echo "  this machine's share was not accepted"
	sealed && echo "Used this machine's share ($(progress) so far)." || { echo "Vault is unsealed."; exit 0; }
fi
[ "$1" = "--machine-only" ] && exit 0

while sealed; do
	printf 'Unseal share (input hidden): '
	stty -echo 2>/dev/null || true   # hide typing on a real terminal; harmless otherwise
	# (a last line without a newline still counts as a share)
	if ! read -r SHARE && [ -z "$SHARE" ]; then stty echo 2>/dev/null || true; echo; echo "No more input; Vault is still sealed ($(progress))."; exit 1; fi
	stty echo 2>/dev/null || true; echo
	[ -z "$SHARE" ] && continue
	[ "$(unseal "$SHARE")" = 200 ] || echo "  not accepted (not a valid share)"
	SHARE=""
	sealed && echo "  $(progress) shares entered; the next share holder can continue (here or with their own 'make unseal')"
done
echo "Vault is unsealed."
