#!/usr/bin/env python3
"""Offline tests for the search service's front. No SearXNG, no network, nothing asked of an engine.

The engine under test is a real HTTP server the test itself serves on the loopback address, the
way the media service's tests run a real stand-in adapter: the front forwards to it and the test
reads what arrived and what came back. Nothing in the front is patched.
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

FRONT_PATH = Path(__file__).resolve().parent / "front.py"
spec = importlib.util.spec_from_file_location("_calliopa_search_front", FRONT_PATH)
front = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
sys.modules[spec.name] = front
spec.loader.exec_module(front)  # type: ignore[union-attr]

BEARER = "the-search-bearer"


class Engine(BaseHTTPRequestHandler):
    """A stand-in SearXNG: records what it was asked and answers like the real one."""

    seen: list[tuple[str, str, dict[str, str]]] = []
    healthy = True

    def log_message(self, *_: object) -> None:
        pass

    def do_GET(self) -> None:  # noqa: N802
        Engine.seen.append((self.command, self.path, {k: v for k, v in self.headers.items()}))
        if self.path == "/healthz":
            self.send_response(200 if Engine.healthy else 503)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"OK")
            return
        if self.path.startswith("/search"):
            body = json.dumps({"query": "example", "results": [{"url": "https://example.com/", "title": "Example", "engines": ["duckduckgo"], "score": 1.0}]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = b"<html>not json</html>"
        self.send_response(403)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def serve(handler) -> tuple[ThreadingHTTPServer, str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def call(url: str, method: str = "GET", bearer: str | None = BEARER):
    request = urllib.request.Request(url, method=method)
    if bearer is not None:
        request.add_header("Authorization", f"Bearer {bearer}")
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, response.headers.get("Content-Type"), response.read()
    except urllib.error.HTTPError as error:
        with error:
            return error.code, error.headers.get("Content-Type"), error.read()


class TheFront(unittest.TestCase):
    engine: ThreadingHTTPServer
    server: ThreadingHTTPServer
    base: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.engine, upstream = serve(Engine)
        handler = front.make_handler(BEARER, upstream)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.engine.shutdown()
        cls.engine.server_close()

    def setUp(self) -> None:
        Engine.seen = []
        Engine.healthy = True

    def test_a_search_needs_the_bearer(self) -> None:
        status, _, body = call(f"{self.base}/search?q=example&format=json", bearer=None)
        self.assertEqual(status, 401)
        self.assertIn("bearer is required", json.loads(body)["error"])
        status, _, _ = call(f"{self.base}/search?q=example&format=json", bearer="wrong")
        self.assertEqual(status, 401)
        self.assertEqual(Engine.seen, [], "nothing reached the engine without the bearer")

    def test_a_search_reaches_the_engine_as_it_came_and_its_answer_comes_back_verbatim(self) -> None:
        status, content_type, body = call(f"{self.base}/search?q=example&format=json&language=en")
        self.assertEqual(status, 200)
        self.assertEqual(content_type, "application/json")
        answered = json.loads(body)
        self.assertEqual(answered["results"][0]["url"], "https://example.com/")
        self.assertEqual([(m, p) for m, p, _ in Engine.seen], [("GET", "/search?q=example&format=json&language=en")])
        self.assertNotIn("Authorization", Engine.seen[0][2], "the bearer stays at the front")

    def test_the_engines_refusal_comes_back_in_its_own_words(self) -> None:
        status, content_type, body = call(f"{self.base}/stats")
        self.assertEqual(status, 403)
        self.assertEqual(content_type, "text/html")
        self.assertEqual(body, b"<html>not json</html>")

    def test_health_is_open_and_reports_the_engine(self) -> None:
        status, _, body = call(f"{self.base}/health", bearer=None)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["engine"], "searxng")
        Engine.healthy = False
        status, _, body = call(f"{self.base}/health", bearer=None)
        self.assertEqual(status, 503)
        self.assertIn("not answering", json.loads(body)["error"])

    def test_only_get_is_answered(self) -> None:
        status, _, body = call(f"{self.base}/search?q=example", method="POST")
        self.assertEqual(status, 405)
        self.assertIn("GET alone", json.loads(body)["error"])
        status, _, _ = call(f"{self.base}/search?q=example", method="POST", bearer=None)
        self.assertEqual(status, 401, "the bearer is asked before the method")
        self.assertEqual(Engine.seen, [])


class TheFrontWithNoEngine(unittest.TestCase):
    def test_an_engine_nobody_answers_is_said_rather_than_hung(self) -> None:
        handler = front.make_handler(BEARER, "http://127.0.0.1:1")
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            base = f"http://127.0.0.1:{server.server_address[1]}"
            status, _, body = call(f"{base}/search?q=example&format=json")
            self.assertEqual(status, 502)
            self.assertIn("not answering", json.loads(body)["error"])
            status, _, _ = call(f"{base}/health", bearer=None)
            self.assertEqual(status, 503)
        finally:
            server.shutdown()
            server.server_close()


class TheBearerFile(unittest.TestCase):
    def test_a_missing_or_empty_bearer_refuses_to_start_in_words(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            missing = os.path.join(directory, "search_bearer")
            with self.assertRaises(SystemExit) as refused:
                front.read_bearer(missing)
            self.assertIn("the stack's bootstrap writes it", str(refused.exception))
            Path(missing).write_text("\n")
            with self.assertRaises(SystemExit):
                front.read_bearer(missing)
            Path(missing).write_text("abc\n")
            self.assertEqual(front.read_bearer(missing), "abc")


class TheEngineProcess(unittest.TestCase):
    def test_the_front_ends_when_the_engine_ends(self) -> None:
        # A stand-in engine process that ends at once: the front must end with
        # it, with a non-zero code, so compose restarts the pair.
        os.environ["CALLIOPA_SEARCH_ENGINE_DIR"] = tempfile.gettempdir()
        served = front.Front(BEARER, "http://127.0.0.1:1", 0, [sys.executable, "-c", "import os, sys; sys.exit(3 if os.getcwd() == os.path.realpath(sys.argv[1]) else 4)", tempfile.gettempdir()])
        self.assertEqual(served.run(), 1)
        self.assertIsNotNone(served.engine)
        self.assertEqual(served.engine.returncode, 3)


if __name__ == "__main__":
    unittest.main()
