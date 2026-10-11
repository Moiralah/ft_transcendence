#!/bin/sh
# Manage teammates' SSH keys for their Vault tunnel (admin, from a laptop with
# sudo SSH access to the GCP proxy). Each key is one line in the `vault` user's
# authorized_keys on GCP, restricted to forwarding to 10.8.0.1:8200 (Vault on
# solsys, over WireGuard): no shell, no other ports, no agent or X11. One line
# per person, so one person's access can be removed on its own.
#
#   scripts/vault/tunnel-key.sh add <name> <public-key-file>
#   scripts/vault/tunnel-key.sh remove <name>
#   scripts/vault/tunnel-key.sh list
#
# Env: TUNNEL_ADMIN_HOST (default gcp, from ~/.ssh/config).
set -e
HOST=${TUNNEL_ADMIN_HOST:-gcp}
CMD=${1:?usage: tunnel-key.sh add <name> <pubkey-file> | remove <name> | list}

case "$CMD" in
add)
	NAME=${2:?usage: tunnel-key.sh add <name> <public-key-file>}
	FILE=${3:?usage: tunnel-key.sh add <name> <public-key-file>}
	printf '%s' "$NAME" | grep -Eq '^[a-z][a-z0-9-]{0,31}$' || { echo "name: lowercase letters, digits, -" >&2; exit 2; }
	KEY=$(grep -E '^(ssh-ed25519|ecdsa-sha2-nistp[0-9]+|ssh-rsa) [A-Za-z0-9+/=]+' "$FILE" | head -n1 | cut -d' ' -f1,2)
	[ -n "$KEY" ] || { echo "$FILE has no SSH public key (the .pub file, not the private key)" >&2; exit 2; }
	LINE="restrict,port-forwarding,permitopen=\"10.8.0.1:8200\",command=\"/usr/sbin/nologin\" $KEY ft-vault-$NAME"
	# shellcheck disable=SC2029  # $LINE is expanded here on purpose
	ssh "$HOST" "set -e
		id vault >/dev/null 2>&1 || sudo useradd --system --create-home --shell /usr/sbin/nologin vault
		sudo install -d -m 700 -o vault -g vault ~vault/.ssh
		F=~vault/.ssh/authorized_keys
		sudo touch \$F; sudo chown vault:vault \$F; sudo chmod 600 \$F
		sudo sed -i '/ ft-vault-$NAME\$/d' \$F
		echo '$LINE' | sudo tee -a \$F >/dev/null
		echo \"[tunnel-key] $NAME: key added (\$(sudo grep -c ' ft-vault-' \$F) people in total)\""
	;;
remove)
	NAME=${2:?usage: tunnel-key.sh remove <name>}
	ssh "$HOST" "sudo sed -i '/ ft-vault-$NAME\$/d' ~vault/.ssh/authorized_keys && echo '[tunnel-key] $NAME: removed'"
	;;
list)
	ssh "$HOST" "sudo grep -o ' ft-vault-[a-z0-9-]*\$' ~vault/.ssh/authorized_keys 2>/dev/null | sed 's/ ft-vault-//' || echo '(no keys yet)'"
	;;
*)
	echo "usage: tunnel-key.sh add <name> <pubkey-file> | remove <name> | list" >&2; exit 2
	;;
esac
