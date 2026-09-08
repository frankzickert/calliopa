#!/usr/bin/env bash
# Turns the memory profile on with the key the kernel's secret store holds.
#
# Honcho refuses to start without an LLM key, and the key is stored encrypted
# by the kernel on its data volume — never in .env and never readable by the
# shell. This reads it through the operator's own kernel command, hands it to
# compose in this process's environment, and writes it nowhere. Run again
# after storing or rotating the key. BO_0200_005 BO_0207_003
set -euo pipefail

cd "$(dirname "$0")/.."

key="$(docker compose exec -T kernel kernel secret read honcho 2>/dev/null | tr -d '\r' || true)"

if [ -z "${key}" ]; then
  echo "no memory key is stored, so the agent's memory will not run" >&2
  exit 0
fi

LLM_OPENAI_API_KEY="${key}" docker compose --profile memory up -d --wait honcho honcho-deriver
echo "memory profile is up"
