#!/bin/sh
# Manage teammates' accounts for their Vault tunnel on the GCP proxy (admin,
# from a laptop with sudo SSH access to GCP). Each person has their own account
# there, named after their intra login (the same name as their Vault login),
# in the group ftvault. It can do one thing: forward to 10.8.0.1:8200 (Vault on
# solsys, over WireGuard). No shell, no password, no other ports, no agent or
# X11. Their authorized_keys is owned by root, so they can't change it.
#
#   scripts/vault/tunnel-key.sh add <login> [public-key-file]   create the account, set or replace the key
#   scripts/vault/tunnel-key.sh remove <login>                  delete the account
#   scripts/vault/tunnel-key.sh list
#
# Env: TUNNEL_ADMIN_HOST (default gcp, from ~/.ssh/config).
set -e
HOST=${TUNNEL_ADMIN_HOST:-gcp}
USAGE="usage: tunnel-key.sh add <login> [public-key-file] | remove <login> | list"
CMD=${1:?$USAGE}

check_login() {
	printf '%s' "$1" | grep -Eq '^[a-z][a-z0-9-]{0,31}$' || { echo "login: lowercase letters, digits, -" >&2; exit 2; }
}

case "$CMD" in
add)
	NAME=${2:?$USAGE}; FILE=$3
	check_login "$NAME"
	LINE=""   # no key file: the account is created without a key, so nobody can log in yet
	if [ -n "$FILE" ]; then
		KEY=$(grep -E '^(ssh-ed25519|ecdsa-sha2-nistp[0-9]+|ssh-rsa) [A-Za-z0-9+/=]+' "$FILE" | head -n1 | cut -d' ' -f1,2)
		[ -n "$KEY" ] || { echo "$FILE has no SSH public key (the .pub file, not the private key)" >&2; exit 2; }
		LINE="restrict,port-forwarding,permitopen=\"10.8.0.1:8200\",command=\"/usr/sbin/nologin\" $KEY ft-vault-$NAME"
	fi
	# shellcheck disable=SC2029  # expanded here on purpose
	ssh "$HOST" "set -e
		getent group ftvault >/dev/null || sudo groupadd --system ftvault
		if id '$NAME' >/dev/null 2>&1; then
			id -nG '$NAME' | grep -qw ftvault || { echo '[tunnel-key] $NAME exists and is not a tunnel account; not touching it' >&2; exit 1; }
		else
			sudo useradd --create-home --shell /usr/sbin/nologin --gid ftvault '$NAME'
		fi
		H=\$(getent passwd '$NAME' | cut -d: -f6)
		sudo install -d -m 755 -o root -g root \$H/.ssh
		if [ -n '$FILE' ]; then
			echo '$LINE' | sudo tee \$H/.ssh/authorized_keys >/dev/null
			sudo chown root:root \$H/.ssh/authorized_keys; sudo chmod 644 \$H/.ssh/authorized_keys
			echo '[tunnel-key] $NAME: key set'
		else
			echo '[tunnel-key] $NAME: account ready, no key yet'
		fi"
	;;
remove)
	NAME=${2:?$USAGE}
	check_login "$NAME"
	ssh "$HOST" "set -e
		id -nG '$NAME' 2>/dev/null | grep -qw ftvault || { echo '[tunnel-key] $NAME is not a tunnel account' >&2; exit 1; }
		sudo pkill -u '$NAME' 2>/dev/null || true
		sudo userdel -r '$NAME' 2>/dev/null
		echo '[tunnel-key] $NAME: account removed'"
	;;
list)
	ssh "$HOST" 'for u in $(getent group ftvault | cut -d: -f4 | tr , " ") $(getent passwd | awk -F: -v g="$(getent group ftvault | cut -d: -f3)" "\$4==g {print \$1}"); do
		h=$(getent passwd "$u" | cut -d: -f6)
		if sudo test -s "$h/.ssh/authorized_keys"; then echo "$u: key set"; else echo "$u: no key yet"; fi
	done | sort -u'
	;;
*)
	echo "$USAGE" >&2; exit 2
	;;
esac
