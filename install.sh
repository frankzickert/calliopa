#!/usr/bin/env bash
# Installs calliopa on Linux and macOS:
#
#   curl -fsSL https://raw.githubusercontent.com/frankzickert/calliopa/main/install.sh | bash
#
# This script is pinned to one release. It checks the release's SHA256SUMS
# against the digest below, and the binary against SHA256SUMS, and installs
# nothing on a mismatch.
#
#   CALLIOPA_INSTALL_DIR   where to install (default ~/.local/bin)
#   CALLIOPA_RELEASE_BASE  where to download from (default GitHub Releases)
set -euo pipefail

# Written by the release; empty until the first one.
CALLIOPA_VERSION=0.1.0
CALLIOPA_SHA256SUMS=30cd7779fda203ed7ef59d8dcc86c21c2457eea44df3e6f338eadbf5d6afcd41

# The download directory; global, so the exit trap still sees it after main.
tmp=

fail() {
	echo "calliopa install: $*" >&2
	exit 1
}

if [ -z "$CALLIOPA_VERSION" ] || [ -z "$CALLIOPA_SHA256SUMS" ]; then
	fail "this installer is not pinned to a release"
fi

platform() {
	local os arch
	os=$(uname -s)
	arch=$(uname -m)
	case "$os/$arch" in
	Linux/x86_64 | Linux/amd64) echo linux_amd64 ;;
	Linux/aarch64 | Linux/arm64) echo linux_arm64 ;;
	Darwin/arm64) echo darwin_arm64 ;;
	Darwin/x86_64) echo darwin_amd64 ;;
	*) fail "$os $arch is not supported; calliopa runs on Linux (amd64, arm64), macOS (Apple Silicon, Intel) and Windows (amd64)" ;;
	esac
}

download() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL -o "$2" "$1"
	elif command -v wget >/dev/null 2>&1; then
		wget -q -O "$2" "$1"
	else
		fail "neither curl nor wget is installed"
	fi || fail "could not download $1"
}

sha256() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$1" | cut -d' ' -f1
	else
		shasum -a 256 "$1" | cut -d' ' -f1
	fi
}

main() {
	local asset base dir want got
	asset="calliopa_${CALLIOPA_VERSION}_$(platform)"
	base="${CALLIOPA_RELEASE_BASE:-https://github.com/frankzickert/calliopa/releases/download/v$CALLIOPA_VERSION}"
	dir="${CALLIOPA_INSTALL_DIR:-$HOME/.local/bin}"
	tmp=$(mktemp -d)
	trap 'rm -rf "$tmp"' EXIT

	echo "Installing calliopa $CALLIOPA_VERSION ($asset)"
	download "$base/SHA256SUMS" "$tmp/SHA256SUMS"
	[ "$(sha256 "$tmp/SHA256SUMS")" = "$CALLIOPA_SHA256SUMS" ] ||
		fail "SHA256SUMS does not match the digest this installer pins; nothing was installed"
	download "$base/$asset" "$tmp/$asset"
	want=$(awk -v f="$asset" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS")
	got=$(sha256 "$tmp/$asset")
	if [ -z "$want" ] || [ "$want" != "$got" ]; then
		fail "$asset does not match SHA256SUMS; nothing was installed"
	fi

	mkdir -p "$dir"
	chmod 0755 "$tmp/$asset"
	if [ "$(uname -s)" = Darwin ]; then
		xattr -d com.apple.quarantine "$tmp/$asset" 2>/dev/null || true
	fi
	cp "$tmp/$asset" "$dir/.calliopa.new"
	mv -f "$dir/.calliopa.new" "$dir/calliopa"

	echo "Installed calliopa $CALLIOPA_VERSION to $dir/calliopa"
	echo "Connect your agent with: calliopa agent install claude   (or: codex)"
	case ":$PATH:" in
	*":$dir:"*) ;;
	*) echo "$dir is not on your PATH. Add it, for example with: echo 'export PATH=\"$dir:\$PATH\"' >> ~/.profile" ;;
	esac
}

main "$@"
