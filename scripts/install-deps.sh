#!/bin/sh
# Installs what `make up` needs on the host and checks the rest: the Supabase
# CLI (local Supabase), plus docker, compose 2.24+, curl, python3 and openssl.
# Run by `make up` before anything else; safe to re-run, does nothing for
# tools that are already installed.
#
#   ./scripts/install-deps.sh
#
# Supabase CLI: Homebrew when it exists (macOS, Linux with Homebrew), otherwise
# the pinned release binary from GitHub into ~/.local/bin (Linux, no sudo).
# https://supabase.com/docs/guides/cli/getting-started
set -e

missing=0
SUPABASE_CLI_VERSION=2.117.0
BIN_DIR=${HOME}/.local/bin
ORIGINAL_PATH=$PATH
need() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "[deps] missing: $1 ($2)" >&2
		missing=1
	fi
}

install_supabase() {
	if command -v brew >/dev/null 2>&1; then
		echo "[deps] installing the Supabase CLI with Homebrew..."
		brew install supabase/tap/supabase
		return
	fi
	# No Homebrew: the release tarball holds one binary, installed to
	# ~/.local/bin, so no root or sudo is needed (42 machines).
	if [ "$(uname -s)" != Linux ]; then
		echo "[deps] Homebrew is needed to install the Supabase CLI on this system:" >&2
		echo "       https://brew.sh  then run: brew install supabase/tap/supabase" >&2
		exit 1
	fi
	case "$(uname -m)" in
		x86_64) arch=amd64 ;;
		aarch64|arm64) arch=arm64 ;;
		*) echo "[deps] no Supabase CLI build for $(uname -m); see https://github.com/supabase/cli/releases" >&2; exit 1 ;;
	esac
	echo "[deps] installing the Supabase CLI $SUPABASE_CLI_VERSION to $BIN_DIR (no sudo)..."
	dir=$(mktemp -d "${TMPDIR:-/tmp}/supabase-cli.XXXXXX")
	curl -fsSL -o "$dir/supabase.tar.gz" \
		"https://github.com/supabase/cli/releases/download/v$SUPABASE_CLI_VERSION/supabase_${SUPABASE_CLI_VERSION}_linux_$arch.tar.gz"
	tar -xzf "$dir/supabase.tar.gz" -C "$dir" supabase
	mkdir -p "$BIN_DIR"
	mv "$dir/supabase" "$BIN_DIR/supabase"
	rm -rf "$dir"
	PATH="$BIN_DIR:$PATH"
	export PATH
	case ":$ORIGINAL_PATH:" in
		*":$BIN_DIR:"*) ;;
		*) echo "[deps] add $BIN_DIR to your PATH (e.g. in ~/.bashrc) so 'supabase' works in new shells" ;;
	esac
}

if ! command -v supabase >/dev/null 2>&1; then
	install_supabase
fi
need supabase "Supabase CLI"

need docker "Docker"
if command -v docker >/dev/null 2>&1; then
	if ! docker info >/dev/null 2>&1; then
		echo "[deps] Docker is installed but not running; start it and run make again" >&2
		missing=1
	else
		# compose v2 prints "Docker Compose version v2.24.0"; compare major.minor.
		compose=$(docker compose version --short 2>/dev/null | sed 's/^v//')
		case "$compose" in
			"") echo "[deps] missing: Docker Compose v2 (docker compose)" >&2; missing=1 ;;
			*)
				major=${compose%%.*}
				minor=$(echo "$compose" | cut -d. -f2)
				if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 24 ]; }; then
					echo "[deps] Docker Compose $compose is too old; need 2.24 or newer" >&2
					missing=1
				fi
				;;
		esac
	fi
fi
need make "GNU make"
need curl "curl"
need python3 "Python 3, used by the Vault scripts"
need openssl "openssl, for the local certificates"

if [ "$missing" -ne 0 ]; then
	exit 1
fi
echo "[deps] all dependencies present."
