#!/usr/bin/env bash
# Turns the memory profile on with the key the shell's connection store holds.
#
# Honcho refuses to start without an LLM key, and the key is stored encrypted
# in the graph-hosted shell's database — never in .env. This reads it through
# the shell's own accessor (scripts/run-honcho-key.mjs in the served tree),
# hands it to compose in this process's environment, and writes it nowhere.
# The tree is the kernel's prod checkout, so this needs a promoted pin that
# carries the shell. Run again after storing or rotating the key.
set -euo pipefail
cd "$(dirname "$0")/.."
tree="$(docker compose exec -T kernel sh -c 'ls -d "$CALLIOPA_KERNEL_DATA"/prod/tree 2>/dev/null || ls -d "$CALLIOPA_KERNEL_DATA"/tree' | tr -d '\r')"
if [ -z "${tree}" ]; then
  echo "no served tree on the kernel volume; promote a pin that carries the shell first" >&2
  exit 1
fi
key="$(docker compose exec -T kernel sh -c "cd '${tree}' && \
  CALLIOPA_DATABASE_URL=\"postgres://\${CALLIOPA_APP_DB_USER}:\$(cat \"\${CALLIOPA_APP_DB_PASSWORD_FILE}\")@\${CALLIOPA_APP_DB_HOST}:\${CALLIOPA_APP_DB_PORT}/\${CALLIOPA_APP_DB_NAME}\" \
  CALLIOPA_SECRETS_KEY=\"\$(cat \"\${CALLIOPA_SECRETS_KEY_PATH}\")\" \
  node scripts/run-honcho-key.mjs" | tr -d '\r')"
if [ -z "${key}" ]; then
  echo "no memory key is stored, so the agent's memory will not run" >&2
  exit 0
fi
LLM_OPENAI_API_KEY="${key}" docker compose --profile memory up -d --wait honcho honcho-deriver
echo "memory profile is up"
