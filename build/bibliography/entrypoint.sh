#!/bin/sh
# The bibliography service's start: the bearer must exist before anything
# serves — a service that cannot tell its caller apart from anyone else does
# not start. The front starts the engine itself and ends when it ends, so
# compose's restart is the supervision of both. BO_0291_001
set -eu

BEARER="${CALLIOPA_BIBLIOGRAPHY_BEARER_FILE:-/run/secrets/calliopa/bibliography_bearer}"
if [ ! -s "$BEARER" ]; then
    echo "bibliography: no bearer at $BEARER; the stack's bootstrap writes it" >&2
    exit 1
fi

exec node /opt/calliopa/bibliography/front.mjs
