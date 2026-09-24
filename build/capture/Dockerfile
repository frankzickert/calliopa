# The page capture service: a headless Chromium behind a small Node server,
# rendering a public page to a PDF, a screenshot and its text for refinement's
# investigations. `docs/system/page-capture-service.md` carries the contract;
# this file is where the image side of it is enforced. This is the dogfood
# Dockerfile with its base pinned by digest; the release script keeps it and
# the sources beside it in step. BO_0277_001 BO_0277_004
#
# The base is Playwright's own image, which carries the browser the pinned
# `playwright` package drives, so the two never drift: the package version
# below is the image tag's. 1.62.1 is the newest image already on the
# development machine (the tree carries no Playwright pin of its own).
FROM mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e

WORKDIR /opt/calliopa/capture

# The browsers are in the image already; the package must not fetch them again.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    CALLIOPA_CAPTURE_PORT=8096

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY lib ./lib
COPY test ./test
COPY server.mjs entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8096
ENTRYPOINT ["/opt/calliopa/capture/entrypoint.sh"]
