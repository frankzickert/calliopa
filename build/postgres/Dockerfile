# PostgreSQL 16 with Apache AGE, plus pgvector built from source — built on
# your machine. The base image is pulled by you from Docker Hub and pgvector
# is cloned from its publisher at the pinned tag; nothing here is Calliopa's
# code and nothing is pulled from a Calliopa registry.
FROM apache/age:release_PG16_1.6.0@sha256:16aa423d20a31aed36a3313244bf7aa00731325862f20ed584510e381f2feaed

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates git build-essential postgresql-server-dev-16 && \
    git clone --depth 1 --branch v0.8.2 https://github.com/pgvector/pgvector.git /tmp/pgvector && \
    cd /tmp/pgvector && \
    make clean && \
    make OPTFLAGS="" && \
    make install && \
    rm -rf /tmp/pgvector && \
    apt-get purge -y --auto-remove git build-essential postgresql-server-dev-16 && \
    rm -rf /var/lib/apt/lists/*
