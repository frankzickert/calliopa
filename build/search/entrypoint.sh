#!/bin/sh
# The search service's start: the bearer must exist before anything serves —
# a service that cannot tell its caller apart from anyone else does not start.
# The front starts the engine itself and ends when it ends, so compose's
# restart is the supervision of both. BO_0281_001
set -eu

BEARER="${CALLIOPA_SEARCH_BEARER_FILE:-/run/secrets/calliopa/search_bearer}"
if [ ! -s "$BEARER" ]; then
    echo "search: no bearer at $BEARER; the stack's bootstrap writes it" >&2
    exit 1
fi

exec python3 /opt/calliopa/search/front.py
