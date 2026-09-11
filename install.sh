#!/usr/bin/env bash
# Calliopa installer. Safe to re-run at any time: a re-run repairs what is
# missing and never overwrites existing configuration, secrets, or data; the
# release's pins are the one thing it rewrites, so a re-run from a newer
# checkout is the update.
set -euo pipefail

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: $1 is required but not installed" >&2
    exit 1
  }
}

# Download: when this script runs outside a Calliopa checkout (for example
# piped from curl), fetch the distribution first and continue from there.
cd "$(dirname "${BASH_SOURCE[0]:-$0}")"
if [ ! -f docker-compose.yml ] || [ ! -f .env.example ]; then
  need git
  target="${CALLIOPA_HOME:-$HOME/calliopa}"
  repo_url="${CALLIOPA_REPO_URL:-https://github.com/frankzickert/calliopa.git}"
  if [ ! -d "$target/.git" ]; then
    echo "downloading Calliopa into $target"
    git clone "$repo_url" "$target"
  fi
  cd "$target"
  exec ./install.sh
fi

need docker
docker compose version >/dev/null 2>&1 || {
  echo "error: the docker compose plugin is required" >&2
  exit 1
}

# The minimum: Docker Engine 25 and Compose 2.24. The recipes rely on the
# BuildKit default and the compose file on inline config content; an older
# Docker fails here, naming what it found, rather than halfway into a build.
version_at_least() {
  # $1: found, $2: required — both "major.minor[.patch]".
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}
engine="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
compose="$(docker compose version --short 2>/dev/null | sed 's/^v//' || true)"
if [ -z "$engine" ]; then
  echo "error: the Docker daemon is not reachable (docker version failed)" >&2
  exit 1
fi
if ! version_at_least "$engine" "25.0"; then
  echo "error: Docker Engine 25 or later is required; found $engine" >&2
  exit 1
fi
if ! version_at_least "$compose" "2.24"; then
  echo "error: Docker Compose 2.24 or later is required; found ${compose:-unknown}" >&2
  exit 1
fi

# The owner's account name (BO_0220_001): asked once, on the run that creates
# .env, because it is immutable after the first boot — the provenance stamp on
# what the install seeds, the core's key, and the credential file's name.
# CALLIOPA_OWNER_PRINCIPAL in the environment answers silently (a scripted
# install); otherwise the terminal is asked, so the one-line curl install can
# answer too; no terminal, or an empty answer, keeps the default. Letters,
# digits, '.', '_', '-' and ':' only: the name is a file name and a path
# segment. The name is not a secret; the install stays zero-secret.
owner_name_rule="the owner's name uses letters, digits, '.', '_', '-' and ':' only"
owner_name_valid() {
  printf '%s' "$1" | grep -Eq '^[A-Za-z0-9._:-]+$'
}
choose_owner_name() {
  if [ -n "${CALLIOPA_OWNER_PRINCIPAL:-}" ]; then
    owner_name_valid "$CALLIOPA_OWNER_PRINCIPAL" || {
      echo "error: CALLIOPA_OWNER_PRINCIPAL='${CALLIOPA_OWNER_PRINCIPAL}': ${owner_name_rule}" >&2
      exit 1
    }
    printf '%s' "$CALLIOPA_OWNER_PRINCIPAL"
    return
  fi
  if ! { : < /dev/tty; } 2>/dev/null; then
    printf 'owner'
    return
  fi
  while :; do
    printf 'Your account name — you sign in with it (letters, digits, . _ - : only) [owner]: ' > /dev/tty
    IFS= read -r answer < /dev/tty || answer=""
    if [ -z "$answer" ]; then
      printf 'owner'
      return
    fi
    if owner_name_valid "$answer"; then
      printf '%s' "$answer"
      return
    fi
    echo "${owner_name_rule} — try again" > /dev/tty
  done
}

# The port Calliopa listens on (BO_0221_002): asked once, on the run that
# creates .env, in the owner prompt's shape — CALLIOPA_PORT in the
# environment answers silently, the terminal is asked otherwise, no terminal
# or an empty answer keeps 8090. An integer from 1024 to 65534, because the
# confirmation origin is published on the next port; a port that already has
# a listener, or whose next one has, is named and the question asked again.
# The confirmation port itself is never asked: it is derived below on every
# run, so changing CALLIOPA_PORT in .env and re-running this script is the
# whole change.
port_rule="the port is a number from 1024 to 65534 (the next port is used too)"
port_valid() {
  printf '%s' "$1" | grep -Eq '^[0-9]+$' && [ "$1" -ge 1024 ] && [ "$1" -le 65534 ]
}
# Prints the ports among $1 and $1+1 that already have a listener. The
# listing comes from ss or netstat where one exists; otherwise a connect to
# loopback stands in, which sees a listener on the default bind and misses
# one bound elsewhere — the best a host without either tool can say.
ports_in_use() {
  local listing="" candidate
  if command -v ss >/dev/null 2>&1; then
    listing="$(ss -ltn 2>/dev/null || true)"
  elif command -v netstat >/dev/null 2>&1; then
    listing="$(netstat -ltn 2>/dev/null || true)"
  fi
  for candidate in "$1" "$(( $1 + 1 ))"; do
    if [ -n "$listing" ]; then
      if printf '%s\n' "$listing" | grep -Eq "[:.]${candidate}[[:space:]]"; then
        printf '%s ' "$candidate"
      fi
    elif (exec 3<>"/dev/tcp/127.0.0.1/${candidate}") 2>/dev/null; then
      printf '%s ' "$candidate"
    fi
  done
}
choose_port() {
  if [ -n "${CALLIOPA_PORT:-}" ]; then
    port_valid "$CALLIOPA_PORT" || {
      echo "error: CALLIOPA_PORT='${CALLIOPA_PORT}': ${port_rule}" >&2
      exit 1
    }
    printf '%s' "$CALLIOPA_PORT"
    return
  fi
  if ! { : < /dev/tty; } 2>/dev/null; then
    printf '8090'
    return
  fi
  while :; do
    printf 'Which port should Calliopa listen on? [8090]: ' > /dev/tty
    IFS= read -r answer < /dev/tty || answer=""
    [ -z "$answer" ] && answer=8090
    if ! port_valid "$answer"; then
      echo "${port_rule} — try again" > /dev/tty
      continue
    fi
    used="$(ports_in_use "$answer")"
    if [ -n "$used" ]; then
      echo "port(s) ${used}already in use on this machine (Calliopa needs ${answer} and $(( answer + 1 ))) — try another" > /dev/tty
      continue
    fi
    printf '%s' "$answer"
    return
  done
}

# Configuration: create .env on first run; on re-run add missing keys only.
if [ ! -f .env ]; then
  owner="$(choose_owner_name)"
  port="$(choose_port)"
  cp .env.example .env
  sed -i "s|^CALLIOPA_OWNER_PRINCIPAL=.*|CALLIOPA_OWNER_PRINCIPAL=${owner}|" .env
  sed -i "s|^CALLIOPA_PORT=.*|CALLIOPA_PORT=${port}|" .env
  echo "created .env from .env.example (the owner's account: ${owner}; port ${port})"
else
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue ;; esac
    key="${line%%=*}"
    if ! grep -q "^${key}=" .env; then
      printf '%s\n' "$line" >> .env
      echo "added missing key ${key} to .env"
    fi
  done < .env.example
fi

# The release's pins follow the checkout on every run — rewritten, never
# kept: they are what the release script wrote, not your configuration, and
# an update that left them alone would rebuild the old binaries under the new
# seed. CALLIOPA_BINARY_SOURCE is yours (an air-gapped site points it at its
# own host) and keeps the missing-key rule above. BO_0223_006
for key in CALLIOPA_RELEASE_VERSION CALLIOPA_RELEASE_SHA256SUMS; do
  value="$(sed -n "s/^${key}=//p" .env.example | tail -1)"
  current="$(sed -n "s/^${key}=//p" .env | tail -1)"
  if [ "$current" != "$value" ]; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
    echo "${key} in .env now follows the checkout: ${value}"
  fi
done

# The confirmation origin's host port follows CALLIOPA_PORT on every run —
# derived, never edited: compose cannot add one to a variable, and two
# hand-kept ports drift into a confirmation page that never loads. Changing
# the port is therefore editing CALLIOPA_PORT and running this script again.
# BO_0221_002
port="$(sed -n 's/^CALLIOPA_PORT=//p' .env | tail -1)"
port="${port:-8090}"
port_valid "$port" || {
  echo "error: CALLIOPA_PORT=${port} in .env: ${port_rule}" >&2
  exit 1
}
confirm_port=$(( port + 1 ))
if grep -q '^CALLIOPA_CONFIRM_PORT=' .env; then
  sed -i "s|^CALLIOPA_CONFIRM_PORT=.*|CALLIOPA_CONFIRM_PORT=${confirm_port}|" .env
else
  printf 'CALLIOPA_CONFIRM_PORT=%s\n' "$confirm_port" >> .env
fi

# Install is zero-secret: agent credentials are configured at first start
# through the UI (or a subscription CLI login), never here. BO_0089_002
# OPENROUTER_API_KEY in .env remains an optional embedding-search input,
# taken from the environment when present — no interactive prompt.
if grep -q '^OPENROUTER_API_KEY=$' .env && [ -n "${OPENROUTER_API_KEY:-}" ]; then
  sed -i "s|^OPENROUTER_API_KEY=$|OPENROUTER_API_KEY=${OPENROUTER_API_KEY}|" .env
  echo "wrote OPENROUTER_API_KEY from the environment into .env (embedding search)"
fi

# The updater directory: the one host path the stack sees, bind-mounted into
# the kernel, carrying the owner's update request and the updater's status
# and nothing else. Created here, before compose would create it as root.
# BO_0223_008
mkdir -p updater
chmod +x scripts/calliopa-updater.sh

# Images. Calliopa publishes none: the object store is pulled from its
# publisher, and the cell, the kernel, the agent service and the database are
# built here from the recipes under build/ — base images pulled by you, the
# Calliopa binaries downloaded from the release named in .env and checked
# against its pinned checksum. A failed download or a checksum mismatch fails
# the install on this line, naming the file, rather than a half-started
# stack. A re-run rebuilds only what the pins changed.
docker compose pull garage
docker compose build

# First-run secret generation and volume preparation. The bootstrap one-shot
# generates the database password and object-store credentials into the
# stack's secrets volume; re-running repairs missing pieces and never
# overwrites existing ones.
docker compose run --rm bootstrap

# Pre-seeding: a release ships its seed bundle under seed/ with a run.sh
# entrypoint that applies it through the Calliopa gateway under your
# identity. The gateway publishes no host port — browser scripts must never
# reach it directly (BO_0103) — so the bundle runs inside the stack, where
# the gateway is reachable on the compose network. Nothing to do when no
# bundle is present.
if [ -x seed/run.sh ]; then
  echo "seed bundle found; starting the cell to apply it"
  docker compose up -d --wait app
  docker compose run --rm --no-deps --entrypoint /bin/sh \
    -v "$(pwd)/seed:/calliopa-seed:ro" kernel \
    /calliopa-seed/run.sh "http://app:8080"
fi

# Start: the install is one command, so it ends with a running stack rather
# than an instruction to start one. Waiting on the kernel waits on the whole
# chain below it, so the address printed below is serving when this returns.
docker compose up -d
docker compose up -d --wait kernel

# The host-side updater (BO_0223_008): a user service running
# scripts/calliopa-updater.sh with your Docker access, so the Update tab's
# button runs the checkout and this script for you. Installed or rewritten on
# every run, so it follows the release; restarted only when this run is not
# the updater's own — an update in progress is never cut mid-run (the updater
# re-executes itself when the release replaced its script). Where no service
# manager answers, the tab shows the commands to run instead.
updater_note=""
install_updater() {
  local script="$(pwd)/scripts/calliopa-updater.sh"
  if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
    local unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
    mkdir -p "$unit_dir"
    cat > "$unit_dir/calliopa-updater.service" <<UNIT
[Unit]
Description=Calliopa updater for $(pwd)
After=default.target

[Service]
Type=simple
WorkingDirectory=$(pwd)
Environment=PATH=$PATH
ExecStart=/usr/bin/env bash $script
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT
    systemctl --user daemon-reload
    systemctl --user enable calliopa-updater.service >/dev/null 2>&1 || true
    if [ -z "${CALLIOPA_UPDATER:-}" ]; then
      systemctl --user restart calliopa-updater.service
    fi
    if loginctl enable-linger "$(id -un)" >/dev/null 2>&1; then
      updater_note="the updater runs as a systemd user service and survives logout"
    else
      updater_note="the updater runs as a systemd user service; it stops when you log out (loginctl enable-linger could not be set)"
    fi
  elif [ "$(uname -s)" = "Darwin" ] && command -v launchctl >/dev/null 2>&1; then
    local plist="$HOME/Library/LaunchAgents/com.calliopa.updater.plist"
    mkdir -p "$(dirname "$plist")"
    cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.calliopa.updater</string>
  <key>ProgramArguments</key><array><string>/usr/bin/env</string><string>bash</string><string>$script</string></array>
  <key>WorkingDirectory</key><string>$(pwd)</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$PATH</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PLIST
    if [ -z "${CALLIOPA_UPDATER:-}" ]; then
      launchctl bootout "gui/$(id -u)/com.calliopa.updater" >/dev/null 2>&1 || true
      launchctl bootstrap "gui/$(id -u)" "$plist" >/dev/null 2>&1 || true
    fi
    updater_note="the updater runs as a launchd agent"
  else
    updater_note="no updater installed (no systemd user session or launchd here): the Update tab shows the commands to run"
  fi
}
install_updater

# The address comes from .env, not this process: compose reads the file, and
# an operator who moved the bind must be told where their stack actually is.
bind="$(sed -n 's/^CALLIOPA_HOST_BIND=//p' .env | tail -1)"

echo
echo "install complete. Calliopa is running at http://${bind:-127.0.0.1}:${port}"
echo "${updater_note}"
echo
echo "Open that address: on your first visit Calliopa asks you to choose the"
echo "owner's password, once. Then sign the agent in from the settings view."
echo "More: https://www.calliopa.com"
