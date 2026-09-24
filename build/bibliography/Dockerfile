# The bibliography service: the Zotero translation server — the engine behind
# Zotero's *add by identifier* and its browser connector — behind a small
# front that holds the bearer and the address rule, so a person adds a source
# from a DOI, an ISBN, a PMID, an arXiv id or a URL and confirms the record
# rather than typing it. `docs/system/bibliography-service.md` carries the
# contract; this file is where the image side of it is enforced. This is the
# dogfood Dockerfile with its base pinned by digest; the release script keeps
# the sources beside it in step. BO_0291_001 BO_0291_004
#
# The engine is built from its repository at a pinned commit, unmodified, with
# its four submodules at the commits that one records. The published image
# (`zotero/translation-server`) is not used: since 2.0.6 (2025-01) it is
# published for arm64 alone, and the last amd64 image is 2.0.4 from 2021, so
# a pin by digest would run under emulation on every amd64 install or run a
# five-year-old translator corpus. A commit is as exact a pin as a digest and
# moves only with this file. Its entrypoint is not used either: it pulls the
# translators' master at every start, which would make a release's corpus
# change under it. The front starts `node src/server.js` directly.
#
# The base is the kernel's Node image, so the stack builds on one Node.
FROM node:22.22.2-bookworm-slim@sha256:9f6d5975c7dca860947d3915877f85607946403fc55349f39b4bc3688448bb6e

# translation-server master, 2026-07-31 ("textSearch: Drop two-word
# requirement for title matching"), and the submodule commits it records.
ARG TRANSLATION_SERVER_COMMIT=3a9d17614896fc1fea73d7b880ea79273b605275
ARG TRANSLATORS_COMMIT=424cfbe720650d51f710f4d9cbf9f4118673c719
ARG UTILITIES_COMMIT=1dd38e27edf81e9d9c4161c957b7efb7f5681ac3
ARG TRANSLATE_COMMIT=e0fe482b8a07e42cbf83545947382008ae7ddb82
ARG SCHEMA_COMMIT=70c3aa98627413d6a30dca955886eafbde085ce9

# git for the fetch of the pinned commits and for the one dependency the
# engine takes from a git address; ca-certificates for both. Nothing else.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Each repository is fetched at its commit alone — no history, no branch —
# so the build fetches the least and the pin cannot drift.
WORKDIR /app
RUN set -eu; \
    fetch() { git init -q "$1" && git -C "$1" remote add origin "$2" && git -C "$1" fetch -q --depth 1 origin "$3" && git -C "$1" checkout -q FETCH_HEAD; }; \
    fetch /app https://github.com/zotero/translation-server "$TRANSLATION_SERVER_COMMIT"; \
    fetch /app/modules/translators https://github.com/zotero/translators "$TRANSLATORS_COMMIT"; \
    fetch /app/modules/utilities https://github.com/zotero/utilities "$UTILITIES_COMMIT"; \
    fetch /app/modules/translate https://github.com/zotero/translate "$TRANSLATE_COMMIT"; \
    fetch /app/modules/zotero-schema https://github.com/zotero/zotero-schema "$SCHEMA_COMMIT"; \
    npm ci --omit=dev --no-audit --no-fund; \
    npm cache clean --force; \
    find /app -name .git -prune -exec rm -rf {} +

# The front: the only listener the compose network sees.
WORKDIR /opt/calliopa/bibliography
ENV CALLIOPA_BIBLIOGRAPHY_PORT=8099 \
    CALLIOPA_BIBLIOGRAPHY_ENGINE_DIR=/app \
    CALLIOPA_BIBLIOGRAPHY_ENGINE_PORT=1969
COPY package.json front.mjs entrypoint.sh ./
COPY lib ./lib
COPY test ./test
RUN chmod +x entrypoint.sh

EXPOSE 8099
ENTRYPOINT ["/opt/calliopa/bibliography/entrypoint.sh"]
