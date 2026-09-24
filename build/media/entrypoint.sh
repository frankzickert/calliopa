#!/bin/sh
# The media service's supervision loop, on the agent image's pattern: the login
# broker beside the service, each restarted if it stops, and the credential homes
# on the data volume. BO_0273_001
set -eu

STATE="${CALLIOPA_MEDIA_STATE:-/var/lib/calliopa/media}"
# The sign-in flow's files live on the volume the kernel mounts too, so the
# served tree writes the request and reads the state itself. BO_0273_025
CONFIG="${CALLIOPA_MEDIA_CONFIG_DIR:-/var/lib/calliopa/media-config}"
HOME_DIR="${HOME:-$STATE/home}"
mkdir -p "$STATE/jobs" "$CONFIG/login" "$HOME_DIR"

# The bearer must exist before anything serves: a service that cannot tell its
# caller apart from anyone else does not start.
BEARER="${CALLIOPA_MEDIA_BEARER_FILE:-/run/secrets/calliopa/media_bearer}"
if [ ! -s "$BEARER" ]; then
    echo "media: no bearer at $BEARER; the stack's bootstrap writes it" >&2
    exit 1
fi

python3 /opt/calliopa/media/login_broker.py &
BROKER=$!

python3 /opt/calliopa/media/service.py &
SERVER=$!

trap 'kill "$BROKER" "$SERVER" 2>/dev/null || true' TERM INT

# Either one stopping ends the container, so compose restarts a clean pair
# rather than leaving half a service answering.
wait -n "$BROKER" "$SERVER" 2>/dev/null || wait "$SERVER"
echo "media: a process stopped; ending so the stack restarts both" >&2
kill "$BROKER" "$SERVER" 2>/dev/null || true
exit 1
