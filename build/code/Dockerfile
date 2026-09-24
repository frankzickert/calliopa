# The code service: the holder of the docker socket that makes runtimes from
# any image with a Jupyter kernelspec and speaks the kernel protocol to the
# sessions in them, behind a small front that holds the bearer.
# `docs/system/code-service.md` carries the contract; this file is where the
# image side of it is enforced; this copy is the release's, the same recipe. BO_0289_001 BO_0289_015
#
# The base is Python's own slim image, pinned by digest so the runtime the
# service runs on moves only with this file; the two libraries are the
# protocol's reference client and the official Docker SDK, each pinned.
FROM python:3.13-slim@sha256:7ce4b6dfe35e55397b7cda544f8a13f191b7ae28dc5aad71fe664dbc9bc2623f

WORKDIR /opt/calliopa/code

ENV CALLIOPA_CODE_PORT=8098 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir --disable-pip-version-check \
        jupyter_client==8.10.0 \
        docker==7.2.0

COPY lib ./lib
COPY test ./test
COPY server.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8098
ENTRYPOINT ["/opt/calliopa/code/entrypoint.sh"]
