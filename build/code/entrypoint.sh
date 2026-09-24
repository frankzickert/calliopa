#!/bin/sh
# The code service's start: the bearer must exist before anything serves —
# a service that holds the docker socket and cannot tell its caller apart from
# anyone else does not start. There is one process, so compose's restart is
# the supervision. BO_0289_001
set -eu

BEARER="${CALLIOPA_CODE_BEARER_FILE:-/run/secrets/calliopa/code_bearer}"
if [ ! -s "$BEARER" ]; then
    echo "code: no bearer at $BEARER; the stack's bootstrap writes it" >&2
    exit 1
fi

exec python3 /opt/calliopa/code/server.py
