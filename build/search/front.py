#!/usr/bin/env python3
"""The search service's front: the bearer in front of SearXNG.

SearXNG answers anyone who can reach its port, and on the compose network that
is every container. The stack's rule is that a service answers the kernel
alone, so this small server sits in front of it: `GET /health` is open and
reports the engine's own health, and everything else needs the bearer the
bootstrap one-shot wrote. What passes is forwarded to the engine as it came —
path, query, headers that matter — and what the engine answered comes back
verbatim, so the kernel and the extension read SearXNG's own JSON.

The front also owns the engine's process: it starts SearXNG's entrypoint,
and when that process ends so does the front, so compose sees one container
die and restarts a clean one. Standard library only. BO_0281_002
"""

from __future__ import annotations

import hmac
import http.client
import json
import os
import signal
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# A search answer is a page of results, tens of kilobytes; a megabyte is far
# above any of them and still far below anything that would hurt the caller.
MAX_ANSWER_BYTES = 4 * 1024 * 1024
# SearXNG's own outgoing timeout is a few seconds per engine; a whole search
# that has not answered in a minute is an engine that has hung.
UPSTREAM_TIMEOUT_S = 60.0


def read_bearer(path: str) -> str:
    """The bearer the bootstrap wrote, or a plain refusal to start."""
    try:
        with open(path, encoding="utf-8") as handle:
            bearer = handle.read().strip()
    except OSError:
        bearer = ""
    if not bearer:
        raise SystemExit(f"search: no bearer at {path}; the stack's bootstrap writes it")
    return bearer


def make_handler(bearer: str, upstream: str):
    """A request handler bound to one bearer and one upstream address."""
    parsed = urllib.parse.urlsplit(upstream)
    host, port = parsed.hostname or "127.0.0.1", parsed.port or 8080
    token = bearer.encode("utf-8")

    class Handler(BaseHTTPRequestHandler):
        server_version = "calliopa-search"
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args) -> None:  # noqa: A002 - the base class's name
            # One line per refused or failed request, nothing for the ordinary ones.
            pass

        # -- answering ---------------------------------------------------------

        def _answer(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def _words(self, status: int, message: str) -> None:
            self._answer(status, json.dumps({"error": message}).encode("utf-8"), "application/json")

        def _authorized(self) -> bool:
            header = self.headers.get("Authorization", "")
            presented = header[7:] if header.startswith("Bearer ") else ""
            return hmac.compare_digest(presented.encode("utf-8"), token)

        # -- the upstream ------------------------------------------------------

        def _forward(self, method: str, path: str):
            """One request to the engine; answers (status, type, body) or None when it is not there."""
            connection = http.client.HTTPConnection(host, port, timeout=UPSTREAM_TIMEOUT_S)
            try:
                headers = {"Accept": self.headers.get("Accept", "application/json")}
                if self.headers.get("Accept-Language"):
                    headers["Accept-Language"] = self.headers["Accept-Language"]
                connection.request(method, path, headers=headers)
                response = connection.getresponse()
                body = response.read(MAX_ANSWER_BYTES + 1)
                if len(body) > MAX_ANSWER_BYTES:
                    return 502, "application/json", json.dumps({"error": "the engine answered more than the front carries"}).encode("utf-8")
                return response.status, response.getheader("Content-Type") or "application/octet-stream", body
            except (OSError, http.client.HTTPException):
                return None
            finally:
                connection.close()

        # -- routes ------------------------------------------------------------

        def do_GET(self) -> None:  # noqa: N802 - the base class's name
            split = urllib.parse.urlsplit(self.path)
            if split.path == "/health":
                # Open, and honest about the engine behind it: the container is
                # healthy only while SearXNG itself answers.
                forwarded = self._forward("GET", "/healthz")
                if forwarded is None or forwarded[0] != 200:
                    self._words(503, "the engine is not answering")
                    return
                self._answer(200, json.dumps({"status": "ok", "engine": "searxng"}).encode("utf-8"), "application/json")
                return
            if not self._authorized():
                self._words(401, "the search bearer is required")
                return
            forwarded = self._forward("GET", self.path)
            if forwarded is None:
                self._words(502, "the engine is not answering")
                return
            status, content_type, body = forwarded
            self._answer(status, body, content_type)

        def do_HEAD(self) -> None:  # noqa: N802
            self.do_GET()

        def _refuse_method(self) -> None:
            if not self._authorized():
                self._words(401, "the search bearer is required")
                return
            self._words(405, "the search service answers GET alone")

        do_POST = do_PUT = do_DELETE = do_PATCH = _refuse_method  # noqa: N815

    return Handler


class Front:
    """The server and, when asked, the engine's process beside it."""

    def __init__(self, bearer: str, upstream: str, port: int, start: list[str] | None) -> None:
        self.server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(bearer, upstream))
        self.server.daemon_threads = True
        self.start = start
        self.engine: subprocess.Popen | None = None

    def run(self) -> int:
        if self.start:
            # The engine's secret key is SearXNG's own concern — cookies and
            # forms nobody here uses — and any random value serves; a fresh one
            # per start keeps nothing on disk.
            env = dict(os.environ)
            env.setdefault("SEARXNG_SECRET", os.urandom(24).hex())
            # The engine's entrypoint imports `searx` from its own directory,
            # so it runs from there, whatever directory the front was started
            # in. Found on the first standalone run: the worker exited with
            # "No module named 'searx'" while the front served on.
            self.engine = subprocess.Popen(self.start, env=env, cwd=os.environ.get("CALLIOPA_SEARCH_ENGINE_DIR", "/usr/local/searxng"))  # noqa: S603

        def stop(*_: object) -> None:
            threading.Thread(target=self.server.shutdown, daemon=True).start()

        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        serving = threading.Thread(target=self.server.serve_forever, daemon=True)
        serving.start()
        code = 0
        try:
            while serving.is_alive():
                if self.engine is not None and self.engine.poll() is not None:
                    print(f"search: the engine ended with {self.engine.returncode}; ending with it", file=sys.stderr)
                    code = 1
                    self.server.shutdown()
                    break
                time.sleep(0.5)
        finally:
            if self.engine is not None and self.engine.poll() is None:
                self.engine.terminate()
                try:
                    self.engine.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    self.engine.kill()
            self.server.server_close()
        return code


def main() -> int:
    bearer = read_bearer(os.environ.get("CALLIOPA_SEARCH_BEARER_FILE", "/run/secrets/calliopa/search_bearer"))
    upstream = os.environ.get("CALLIOPA_SEARCH_UPSTREAM", "http://127.0.0.1:8080")
    port = int(os.environ.get("CALLIOPA_SEARCH_PORT", "8097"))
    start_command = os.environ.get("CALLIOPA_SEARCH_START", "/usr/local/searxng/entrypoint.sh")
    start = [start_command] if start_command else None
    return Front(bearer, upstream, port, start).run()


if __name__ == "__main__":
    sys.exit(main())
