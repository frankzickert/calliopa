#!/usr/bin/env bash
# Calliopa installer. Safe to re-run at any time: a re-run repairs what is
# missing and never overwrites existing configuration, secrets, or data.
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

# Configuration: create .env on first run; on re-run add missing keys only.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "created .env from .env.example"
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

# Install is zero-secret: agent credentials are configured at first start
# through the UI (or a subscription CLI login), never here. BO_0089_002
# OPENROUTER_API_KEY in .env remains an optional embedding-search input,
# taken from the environment when present — no interactive prompt.
if grep -q '^OPENROUTER_API_KEY=$' .env && [ -n "${OPENROUTER_API_KEY:-}" ]; then
  sed -i "s|^OPENROUTER_API_KEY=$|OPENROUTER_API_KEY=${OPENROUTER_API_KEY}|" .env
  echo "wrote OPENROUTER_API_KEY from the environment into .env (embedding search)"
fi

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

# The address comes from .env, not this process: compose reads the file, and
# an operator who moved the bind must be told where their stack actually is.
bind="$(sed -n 's/^CALLIOPA_HOST_BIND=//p' .env | tail -1)"

echo
echo "install complete. Calliopa is running at http://${bind:-127.0.0.1}:8090"
echo
echo "Sign the agent in from the settings view. More: https://www.calliopa.com"
