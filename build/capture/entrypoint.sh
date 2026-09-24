#!/bin/sh
# The capture service's start: the bearer must exist before anything serves —
# a service that cannot tell its caller apart from anyone else does not start.
# There is one process, so compose's restart is the supervision. BO_0277_001
set -eu

BEARER="${CALLIOPA_CAPTURE_BEARER_FILE:-/run/secrets/calliopa/capture_bearer}"
if [ ! -s "$BEARER" ]; then
    echo "capture: no bearer at $BEARER; the stack's bootstrap writes it" >&2
    exit 1
fi

exec node /opt/calliopa/capture/server.mjs
