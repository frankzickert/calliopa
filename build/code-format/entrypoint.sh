#!/bin/sh
# The formatter's start: the bearer must exist before anything serves, as the
# code service's must. There is one process, so compose's restart is the
# supervision. BO_0296_001
set -eu

BEARER="${CALLIOPA_CODE_FORMAT_BEARER_FILE:-/run/secrets/calliopa/code_format_bearer}"
if [ ! -s "$BEARER" ]; then
    echo "code-format: no bearer at $BEARER; the stack's bootstrap writes it" >&2
    exit 1
fi

exec python3 /opt/calliopa/code-format/server.py
