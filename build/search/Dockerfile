# The search service: SearXNG, the stack's own web search engine, behind a
# small front that holds the bearer, for refinement's outward reach.
# `docs/system/search-service.md` carries the contract; this file is where
# the image side of it is enforced. This is the dogfood Dockerfile, already
# pinned by digest; the release script keeps the sources beside it in step.
# BO_0281_001 BO_0281_005
#
# The base is SearXNG's own image, run unmodified: the front beside it is a
# separate process that only forwards HTTP to it. The image publishes one
# moving tag, so the pin is the digest, and it moves only with this file.
# 2026.9.22-019460e07 is the version behind the digest below.
FROM searxng/searxng:latest@sha256:4109ebf36dc291931c5b43f5ee451c517085255aecfa71f8ffae21000ce5c5fa

# The engine listens on the loopback address alone; the front is what the
# network reaches. SearXNG's own entrypoint reads the bind through granian's
# variables.
ENV GRANIAN_HOST=127.0.0.1 \
    GRANIAN_PORT=8080 \
    CALLIOPA_SEARCH_PORT=8097 \
    CALLIOPA_SEARCH_UPSTREAM=http://127.0.0.1:8080

# The engine's settings, in the place its entrypoint reads them from; present,
# so the entrypoint creates nothing from its template.
COPY settings.yml /etc/searxng/settings.yml
RUN chown searxng:searxng /etc/searxng/settings.yml

WORKDIR /opt/calliopa/search
COPY front.py test_front.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8097
ENTRYPOINT ["/opt/calliopa/search/entrypoint.sh"]
