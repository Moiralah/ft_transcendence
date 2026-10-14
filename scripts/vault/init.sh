#!/bin/sh
# ONE-TIME setup of a server-mode Vault: splits the unseal key into 5 shares,
# any 2 of which unlock Vault (Shamir). Run once per Vault, never again.
#
#   VAULT_CONTAINER=<name> scripts/vault/init.sh <output-file>
#
# <output-file> receives the 5 shares and the initial root token (chmod 600).
# Hand one share to each holder (Tiara, solsys, Yiwei, Jon, Moira), keep them
# offline, then DELETE this file. The root token is revoked by configure.sh.
set -e
C=${VAULT_CONTAINER:-vault-rehearsal-vault-1}
OUT=${1:?usage: init.sh <output-file>}
[ -e "$OUT" ] && { echo "refusing to overwrite $OUT"; exit 1; }

if docker exec "$C" vault status -format=json | grep -q '"initialized": true'; then
	echo "Vault in $C is already initialized; nothing to do."; exit 1
fi

umask 077
docker exec "$C" vault operator init -key-shares=5 -key-threshold=2 -format=json > "$OUT"
chmod 600 "$OUT"
echo "Initialized. 5 shares (any 2 unlock) + root token written to $OUT (owner-only)."
echo "Next: scripts/vault/unseal.sh, then scripts/vault/configure.sh $OUT"
