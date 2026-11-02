#!/bin/sh
# Installs what `make up` needs on the host and checks the rest: the Supabase
# CLI (local Supabase), plus docker, compose 2.24+, curl, python3 and openssl.
# Run by `make up` before anything else; safe to re-run, does nothing for
# tools that are already installed.
#
#   ./scripts/install-deps.sh
#
# Supabase CLI: Homebrew when it exists (macOS, Linux with Homebrew), otherwise
# the .deb or .rpm package from the latest GitHub release (Linux, asks for sudo).
# https://supabase.com/docs/guides/cli/getting-started
set -e

missing=0
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
	if [ "$(uname -s)" != Linux ]; then
		echo "[deps] Homebrew is needed to install the Supabase CLI on this system:" >&2
		echo "       https://brew.sh  then run: brew install supabase/tap/supabase" >&2
		exit 1
	fi
	case "$(uname -m)" in
		x86_64) arch=amd64 ;;
		aarch64|arm64) arch=arm64 ;;
		*) echo "[deps] no Supabase CLI package for $(uname -m); see https://supabase.com/docs/guides/cli/getting-started" >&2; exit 1 ;;
	esac
	if command -v dpkg >/dev/null 2>&1; then ext=deb
	elif command -v rpm >/dev/null 2>&1; then ext=rpm
	else
		echo "[deps] no dpkg or rpm here; install the CLI by hand: https://github.com/supabase/cli/releases" >&2
		exit 1
	fi
	echo "[deps] installing the Supabase CLI from the latest GitHub release (.$ext)..."
	url=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest | python3 -c '
import json, re, sys
ext, arch = sys.argv[1], sys.argv[2]
for asset in json.load(sys.stdin)["assets"]:
    if re.search(r"linux_" + arch + r"\." + ext + r"$", asset["name"]):
        print(asset["browser_download_url"])
        break
' "$ext" "$arch")
	if [ -z "$url" ]; then
		echo "[deps] no .$ext package found in the latest release; see https://github.com/supabase/cli/releases" >&2
		exit 1
	fi
	pkg=$(mktemp "${TMPDIR:-/tmp}/supabase-cli.XXXXXX.$ext")
	curl -fsSL -o "$pkg" "$url"
	if [ "$ext" = deb ]; then sudo dpkg -i "$pkg"; else sudo rpm -i "$pkg"; fi
	rm -f "$pkg"
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
