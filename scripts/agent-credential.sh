#!/usr/bin/env bash
# Issues the agent's `cak_` proposer credential for the graph-hosted shell's
# authenticated API and hands it to Hermes.
#
# The shell issues API clients with its own tooling (scripts/run-client.mjs in the
# served tree), against its own database. The token is printed once by that
# tool; this script writes it to the secrets volume as agent_tools_token —
# through the bootstrap image, which is the one writer of that volume — and
# restarts Hermes, whose entrypoint reads the file and registers the shell's
# toolset. Re-running rotates: the shell tool revokes nothing by itself, so
# the previous client stays listed until `client.mjs revoke`.
set -euo pipefail
cd "$(dirname "$0")/.."
name="${1:-hermes}"
tree="$(docker compose exec -T kernel sh -c 'ls -d "$CALLIOPA_KERNEL_DATA"/tree 2>/dev/null' | tr -d '\r')"
if [ -z "${tree}" ]; then
  echo "no served tree on the kernel volume; promote a pin that carries the shell first" >&2
  exit 1
fi
# The tool prints the token as the last line of its output; everything else
# is the human-facing description, which stays on stderr here.
token="$(docker compose exec -T kernel sh -c "cd '${tree}' && \
  CALLIOPA_DATABASE_URL=\"postgres://\${CALLIOPA_APP_DB_USER}:\$(cat \"\${CALLIOPA_APP_DB_PASSWORD_FILE}\")@\${CALLIOPA_APP_DB_HOST}:\${CALLIOPA_APP_DB_PORT}/\${CALLIOPA_APP_DB_NAME}\" \
  CALLIOPA_SECRETS_KEY=\"\$(cat \"\${CALLIOPA_SECRETS_KEY_PATH}\")\" \
  node scripts/run-client.mjs issue '${name}' --proposer" | tr -d '\r' | grep -oE 'cak_[A-Za-z0-9_-]+' | tail -1)"
if [ -z "${token}" ]; then
  echo "the shell's client tool printed no cak_ token" >&2
  exit 1
fi
printf '%s' "${token}" | docker compose run --rm -T --no-deps bootstrap \
  sh -c 'umask 077; cat > /run/secrets/calliopa/agent_tools_token'
unset token
docker compose restart hermes >/dev/null
echo "agent credential '${name}' issued and handed to hermes"
