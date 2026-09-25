#!/usr/bin/env python3
"""The formatter's front: the bearer, one route, and a promise never to fail.

`GET /health` is open; `POST /v1/format` needs the bearer the bootstrap
one-shot wrote, and the code service is the only caller that holds it. The
route answers the text to write and whether anything was rewritten — an
unknown language, a source that does not parse, a source over the cap, a
formatter that hangs and a service too busy are all answered the same way,
with the source exactly as it came. Standard library for the server, four
formatters behind it. `docs/system/code-service.md`, Formatting. BO_0296_001
"""

from __future__ import annotations

import hmac
import json
import os
from collections.abc import Mapping
import signal
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.caps import Caps  # noqa: E402
from lib.formatters import format_source, languages  # noqa: E402

MAX_JSON_BYTES = 8 * 1024**2


def read_bearer(path: str, environ: Mapping[str, str] | None = None) -> str:
    """The bearer as the entrypoint hands it in the environment — it read the
    file as root before dropping to the formatter user (BO_0296_010) — or,
    run without the entrypoint, read from the file."""
    handed = (environ if environ is not None else os.environ).get("CALLIOPA_CODE_FORMAT_BEARER", "").strip()
    if handed:
        return handed
    try:
        with open(path, encoding="utf-8") as handle:
            bearer = handle.read().strip()
    except OSError:
        bearer = ""
    if not bearer:
        raise SystemExit(f"code-format: no bearer at {path}; the stack's bootstrap writes it")
    return bearer


class Service:
    """The formatters and the server over them."""

    def __init__(self, caps: Caps, bearer: str, port: int) -> None:
        self.caps = caps
        # A bounded semaphore is the concurrency cap: a request that cannot
        # take a slot within the queue wait is answered unchanged rather than
        # held, because the person on the other end has already left the field.
        self.slots = threading.BoundedSemaphore(max(1, caps.concurrency))
        self.server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(bearer, self))
        self.server.daemon_threads = True

    @property
    def port(self) -> int:
        return self.server.server_address[1]

    def health(self) -> dict[str, Any]:
        return {"status": "ok", "languages": len(languages())}

    def format(self, source: str, language: str | None) -> dict[str, Any]:
        if not self.slots.acquire(timeout=self.caps.queue_wait_s):
            return {"source": source, "formatted": False, "reason": "every formatter is busy"}
        try:
            done = format_source(source, language, self.caps.timeout_s, self.caps.source_max_bytes)
        finally:
            self.slots.release()
        answer: dict[str, Any] = {"source": done.source, "formatted": done.formatted}
        if done.reason:
            answer["reason"] = done.reason
        return answer

    def serve_in_thread(self) -> threading.Thread:
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        return thread

    def shutdown(self) -> None:
        self.server.shutdown()
        self.server.server_close()

    def run(self) -> int:
        def stop(*_: object) -> None:
            threading.Thread(target=self.server.shutdown, daemon=True).start()

        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        print(f"code-format: serving on {self.port} with {len(languages())} languages", file=sys.stderr)
        try:
            self.server.serve_forever()
        finally:
            self.server.server_close()
        return 0


def make_handler(bearer: str, service: Service):
    token = bearer.encode("utf-8")

    class Handler(BaseHTTPRequestHandler):
        server_version = "calliopa-code-format"
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args) -> None:  # noqa: A002 - the base class's name
            pass

        def _answer(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def _json(self, status: int, value: Any) -> None:
            self._answer(status, json.dumps(value).encode("utf-8"), "application/json")

        def _words(self, status: int, message: str) -> None:
            self._json(status, {"error": message})

        def _authorized(self) -> bool:
            header = self.headers.get("Authorization", "")
            presented = header[7:] if header.startswith("Bearer ") else ""
            return hmac.compare_digest(presented.encode("utf-8"), token)

        def _dispatch(self) -> None:
            path = urllib.parse.urlsplit(self.path).path
            if path == "/health" and self.command in ("GET", "HEAD"):
                self._json(200, service.health())
                return
            if not self._authorized():
                self._words(401, "the code format bearer is required")
                return
            if path == "/v1/languages":
                if self.command != "GET":
                    self._words(405, "not a method of this route")
                    return
                self._json(200, {"languages": languages()})
                return
            if path == "/v1/format":
                if self.command != "POST":
                    self._words(405, "not a method of this route")
                    return
                self._format()
                return
            self._words(404, "no such route")

        do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = _dispatch  # noqa: N815

        def _format(self) -> None:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_JSON_BYTES:
                self._words(413, f"the body is above {MAX_JSON_BYTES} bytes")
                return
            raw = self.rfile.read(length) if length else b""
            try:
                body = json.loads(raw) if raw else {}
            except json.JSONDecodeError as broken:
                self._words(400, f"the body is not JSON: {broken.msg}")
                return
            if not isinstance(body, dict):
                self._words(400, "the body is a JSON object")
                return
            source = body.get("source")
            if not isinstance(source, str):
                self._words(400, "source is the code as text")
                return
            language = body.get("language")
            if language is not None and not isinstance(language, str):
                self._words(400, "language is a word or nothing")
                return
            self._json(200, service.format(source, language))

    return Handler


def main() -> int:
    caps = Caps.from_env(os.environ)
    bearer = read_bearer(os.environ.get("CALLIOPA_CODE_FORMAT_BEARER_FILE", "/run/secrets/calliopa/code_format_bearer"))
    port = int(os.environ.get("CALLIOPA_CODE_FORMAT_PORT") or 8093)
    return Service(caps, bearer, port).run()


if __name__ == "__main__":
    raise SystemExit(main())
