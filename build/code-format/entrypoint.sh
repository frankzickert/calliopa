#!/bin/sh
# The formatter's start: the bearer must exist before anything serves, as the
# code service's must. The bootstrap writes the bearer 0600 root:root, so this
# runs as root only long enough to read it, then hands it to the server in the
# environment and drops to the unprivileged `formatter` user with setpriv —
# the image keeps its non-root posture and the secret keeps its mode (user
# decision, 2026-09-24). There is one process, so compose's restart is the
# supervision. BO_0296_001, BO_0296_010
set -eu

BEARER="${CALLIOPA_CODE_FORMAT_BEARER_FILE:-/run/secrets/calliopa/code_format_bearer}"
if [ ! -s "$BEARER" ]; then
    echo "code-format: no bearer at $BEARER; the stack's bootstrap writes it" >&2
    exit 1
fi

CALLIOPA_CODE_FORMAT_BEARER="$(cat "$BEARER")"
export CALLIOPA_CODE_FORMAT_BEARER

if [ "$(id -u)" = "0" ]; then
    exec setpriv --reuid=formatter --regid=formatter --init-groups \
        env HOME=/home/formatter python3 /opt/calliopa/code-format/server.py
fi
exec python3 /opt/calliopa/code-format/server.py
