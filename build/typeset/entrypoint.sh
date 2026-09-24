#!/bin/sh
# The typesetting service's start: the bearer must exist before anything
# serves — a service that cannot tell its caller apart from anyone else does
# not start. BO_0293_001
set -eu

BEARER="${CALLIOPA_TYPESET_BEARER_FILE:-/run/secrets/calliopa/typeset_bearer}"
if [ ! -s "$BEARER" ]; then
    echo "typeset: no bearer at $BEARER; the stack's bootstrap writes it" >&2
    exit 1
fi

exec python3 /opt/calliopa/typeset/front.py
