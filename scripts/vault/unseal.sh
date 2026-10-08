#!/bin/sh
# Unseal Vault after a (re)start. Needs 2 of the 5 shares.
#
#   VAULT_CONTAINER=<name> [VAULT_LOCAL_SHARE_FILE=<file>] scripts/vault/unseal.sh
#
# If VAULT_LOCAL_SHARE_FILE points at this machine's own share (solsys keeps
# one, root-only, outside Vault's data), it is used first, so one person typing
# their share is enough. Typed shares are never echoed or stored.
set -e
C=${VAULT_CONTAINER:-vault-rehearsal-vault-1}

sealed() { docker exec "$C" vault status -format=json 2>/dev/null | grep -q '"sealed": true'; }
progress() { docker exec "$C" vault status -format=json 2>/dev/null | sed -n 's/.*"progress": \([0-9]*\).*/\1/p'; }

if ! sealed; then echo "Vault is already unsealed."; exit 0; fi

if [ -n "$VAULT_LOCAL_SHARE_FILE" ] && [ -r "$VAULT_LOCAL_SHARE_FILE" ]; then
	docker exec "$C" vault operator unseal "$(cat "$VAULT_LOCAL_SHARE_FILE")" >/dev/null
	echo "Used this machine's share ($(progress)/2 so far)."
fi

while sealed; do
	printf 'Unseal share (input hidden): '
	stty -echo 2>/dev/null || true   # hide typing on a real terminal; harmless otherwise
	if ! read -r SHARE; then stty echo 2>/dev/null || true; echo; echo "No more input; Vault is still sealed."; exit 1; fi
	stty echo 2>/dev/null || true; echo
	[ -z "$SHARE" ] && continue
	docker exec "$C" vault operator unseal "$SHARE" >/dev/null 2>&1 || echo "  not accepted (not a valid share)"
	SHARE=""
	sealed && echo "  $(progress)/2 shares entered"
done
echo "Vault is unsealed."
