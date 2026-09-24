# The media service: Calliopa's generator. It holds the two vendor CLIs and their
# credentials so nothing else in the stack does, and it is the one place a paid
# call is made. `docs/system/media-service.md` carries the contract; this file is
# where the image side of it is enforced. This is the dogfood Dockerfile
# with its bases pinned by digest; the release script keeps it and the
# sources beside it in step. BO_0273_001 BO_0273_006
FROM python:3.13-slim@sha256:7ce4b6dfe35e55397b7cda544f8a13f191b7ae28dc5aad71fe664dbc9bc2623f

# Pillow is the one package an adapter needs (`openart-seedream`); everything
# else here, the service included, is standard library.
RUN pip install --no-cache-dir "Pillow>=11,<13"

# Node comes from the official image rather than from Debian, for the same
# reason the agent image takes it there: Debian's `nodejs` on this base is older
# than the CLI declares, and installing on it succeeds with a warning and leaves
# an unsupported runtime to be found at the first real call. The tag matches the
# python base's Debian release, so there is one libc in the image.
COPY --from=node:22-trixie-slim@sha256:7b8a0c89c54499bee567618f96578e1a12a800f062fbdbfd1fb6a443fa6f6284 /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-trixie-slim@sha256:7b8a0c89c54499bee567618f96578e1a12a800f062fbdbfd1fb6a443fa6f6284 /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

# The two vendor CLIs, each installed the way its own documentation installs it.
# `curl` is the OpenArt installer's transport and also the way a Higgsfield OAuth
# redirect is handed back to a listener inside this container, which is the only
# route that works when the callback host is unreachable from the browser
# (`adapters/higgsfield-seedance/README.md`, Setup).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && npm install -g @higgsfield/cli \
    && npm cache clean --force \
    && curl -fsSL https://raw.githubusercontent.com/OpenArt-AI/cli/main/install.sh | sh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Both credential homes live on the data volume rather than in the image, so
# signing in survives a rebuild, as the agent image does it.
ENV HOME=/var/lib/calliopa/media/home \
    CALLIOPA_MEDIA_STATE=/var/lib/calliopa/media \
    CALLIOPA_MEDIA_CONFIG_DIR=/var/lib/calliopa/media-config \
    CALLIOPA_MEDIA_PORT=8095 \
    PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin

COPY service.py /opt/calliopa/media/service.py
COPY options.py /opt/calliopa/media/options.py
COPY login_broker.py /opt/calliopa/media/login_broker.py
COPY entrypoint.sh /opt/calliopa/media/entrypoint.sh
COPY adapters /opt/calliopa/media/adapters
RUN chmod +x /opt/calliopa/media/entrypoint.sh

EXPOSE 8095 8765
ENTRYPOINT ["/opt/calliopa/media/entrypoint.sh"]
