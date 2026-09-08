# The Calliopa kernel — pinned Node, pinned pnpm, and the kernel binary,
# nothing else — built on your machine. The base image is pulled by you from
# Docker Hub; the kernel binary is downloaded from the release named in .env
# and checked before it is installed. Vite and the Qwik optimizer are absent
# on purpose: they arrive from a working tree's own lockfile at install time.
#
# The download runs inside the build step rather than through `ADD <url>`:
# ADD is fetched by the Docker daemon, on Docker Desktop through the host's
# proxy, while a build step fetches on the network every container uses.
FROM node:22.22.2-bookworm-slim@sha256:9f6d5975c7dca860947d3915877f85607946403fc55349f39b4bc3688448bb6e

ARG CALLIOPA_RELEASE_VERSION
ARG CALLIOPA_BINARY_SOURCE=https://github.com/frankzickert/calliopa/releases/download
ARG CALLIOPA_RELEASE_SHA256SUMS
ARG TARGETARCH

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates wget && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /calliopa-release
RUN test -n "${CALLIOPA_RELEASE_VERSION}" && test -n "${CALLIOPA_RELEASE_SHA256SUMS}" || \
    { echo "CALLIOPA_RELEASE_VERSION and CALLIOPA_RELEASE_SHA256SUMS must be set in .env: no release is pinned" >&2; exit 1; }
RUN wget -q "${CALLIOPA_BINARY_SOURCE}/v${CALLIOPA_RELEASE_VERSION}/SHA256SUMS" && \
    echo "${CALLIOPA_RELEASE_SHA256SUMS}  SHA256SUMS" | sha256sum -c - && \
    wget -q "${CALLIOPA_BINARY_SOURCE}/v${CALLIOPA_RELEASE_VERSION}/kernel-linux-${TARGETARCH}" && \
    grep -E " kernel-linux-${TARGETARCH}$" SHA256SUMS | sha256sum -c - && \
    install -m 0755 kernel-linux-${TARGETARCH} /usr/local/bin/kernel && \
    rm -rf /calliopa-release

RUN npm install -g pnpm@11.9.0

WORKDIR /work
ENTRYPOINT ["kernel"]
