# The code formatter: the container that parses a code block's source so that
# the service holding the docker socket never has to. It carries four
# formatters and nothing else — no socket, no credential, no route out — and
# answers the code service alone. `docs/system/code-service.md`, Formatting.
# BO_0296_001
#
# Every stage is pinned by digest, so what a release formats with moves only
# with this file. The formatters are taken from the images that build them
# rather than installed from a distribution, because three of the four are
# single self-contained binaries and copying one is smaller and more exact
# than installing a toolchain to get it.
FROM node:22-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9 AS prettier
RUN npm install --global --no-audit --no-fund prettier@3.9.9

FROM golang:1.25-bookworm@sha256:3b4a11519ad929d1e1d261a12cff056f0c85b735253d7d861346b9c6f8b36437 AS gotools

FROM mvdan/shfmt:v3.12.0-alpine@sha256:204a4d2d876123342ad394bd9a28fb91e165abc03868790d4b39cfa73233f150 AS shfmt

FROM python:3.13-slim@sha256:7ce4b6dfe35e55397b7cda544f8a13f191b7ae28dc5aad71fe664dbc9bc2623f

WORKDIR /opt/calliopa/code-format

ENV CALLIOPA_CODE_FORMAT_PORT=8093 \
    PYTHONUNBUFFERED=1 \
    PRETTIER_CLI=/opt/prettier/bin/prettier.cjs

RUN pip install --no-cache-dir --disable-pip-version-check black==26.5.1

# `node` and `gofmt` are dynamically linked against glibc and come from Debian
# images; `shfmt` is a static Go binary and runs here although its image is
# Alpine's. Each is proven to run by `test/test_formatters.py`, which formats a
# sample of every language the table names.
COPY --from=prettier /usr/local/bin/node /usr/local/bin/node
COPY --from=prettier /usr/local/lib/node_modules/prettier /opt/prettier
COPY --from=gotools /usr/local/go/bin/gofmt /usr/local/bin/gofmt
COPY --from=shfmt /bin/shfmt /usr/local/bin/shfmt

COPY lib ./lib
COPY test ./test
COPY server.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

# The formatters run in an empty directory owned by nobody, so a config file
# cannot be picked up from a working directory and nothing written by a
# formatter outlives the request.
RUN useradd --system --create-home --home-dir /home/formatter formatter \
    && mkdir -p /work && chown formatter:formatter /work
USER formatter
ENV HOME=/home/formatter

EXPOSE 8093
ENTRYPOINT ["/opt/calliopa/code-format/entrypoint.sh"]
