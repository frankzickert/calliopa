# The Calliopa cell — bootstrap, app, migrate, seed, and the garage-init and
# backup scripts — built on your machine. The base image is pulled by you
# from Docker Hub; the Calliopa binaries are downloaded from the release
# named in .env and checked against the release's checksum file, which is
# itself checked against the one digest pinned in .env, before anything else
# happens. Nothing is pulled from a Calliopa registry: there is none.
#
# The download runs inside the build step rather than through `ADD <url>`,
# because ADD is fetched by the Docker daemon — on Docker Desktop through the
# host's proxy — while a build step fetches on the same network every other
# container uses, which is what an internal release host is reachable on.
FROM debian:bookworm-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818

ARG CALLIOPA_RELEASE_VERSION
ARG CALLIOPA_BINARY_SOURCE=https://github.com/frankzickert/calliopa/releases/download
ARG CALLIOPA_RELEASE_SHA256SUMS
ARG TARGETARCH

# What the download, the app's health probe, garage-init and backup need.
# pg_dump must match the PG16 server, newer than bookworm's packaged client,
# hence PGDG.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates wget curl jq rclone && \
    install -d /usr/share/postgresql-common/pgdg && \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc && \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client-16 && \
    rm -rf /var/lib/apt/lists/*

# No release pinned, no build: the check fails naming the missing pin rather
# than downloading from a nameless URL. Then: the checksum file against the
# pinned digest, the binaries against the checksum file, and only then the
# install.
WORKDIR /calliopa-release
RUN test -n "${CALLIOPA_RELEASE_VERSION}" && test -n "${CALLIOPA_RELEASE_SHA256SUMS}" || \
    { echo "CALLIOPA_RELEASE_VERSION and CALLIOPA_RELEASE_SHA256SUMS must be set in .env: no release is pinned" >&2; exit 1; }
RUN wget -q "${CALLIOPA_BINARY_SOURCE}/v${CALLIOPA_RELEASE_VERSION}/SHA256SUMS" && \
    echo "${CALLIOPA_RELEASE_SHA256SUMS}  SHA256SUMS" | sha256sum -c - && \
    for bin in app bootstrap migrate seed; do \
      wget -q "${CALLIOPA_BINARY_SOURCE}/v${CALLIOPA_RELEASE_VERSION}/${bin}-linux-${TARGETARCH}"; \
    done && \
    grep -E " (app|bootstrap|migrate|seed)-linux-${TARGETARCH}$" SHA256SUMS | sha256sum -c - && \
    install -m 0755 app-linux-${TARGETARCH} /usr/local/bin/app && \
    install -m 0755 bootstrap-linux-${TARGETARCH} /usr/local/bin/bootstrap && \
    install -m 0755 migrate-linux-${TARGETARCH} /usr/local/bin/migrate && \
    install -m 0755 seed-linux-${TARGETARCH} /usr/local/bin/seed && \
    rm -rf /calliopa-release

WORKDIR /app
COPY migrations /app/db/migrations
COPY init-garage.sh /usr/local/bin/init-garage
COPY backup.sh /usr/local/bin/backup
RUN chmod +x /usr/local/bin/init-garage /usr/local/bin/backup

EXPOSE 8080
