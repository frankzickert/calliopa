"""The hop to the formatter, against a real HTTP server standing in for it.

What matters here is not that formatting works — that is the formatter's own
suite — but that *nothing* reaches the caller as a failure. A settled edit is
already typed; if this hop cannot improve it, the block is written as it was.
BO_0296_003
"""

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from lib.format import Formatting, format_source

BEARER = "a-test-bearer"


def stand_in(answer, status=200, delay=0.0):
    """A formatter that answers whatever the case needs."""

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *_args):
            pass

        def do_POST(self):
            import time

            length = int(self.headers.get("Content-Length") or 0)
            self.seen = json.loads(self.rfile.read(length) or b"{}")
            Handler.last = self.seen
            Handler.authorization = self.headers.get("Authorization", "")
            if delay:
                time.sleep(delay)
            body = answer if isinstance(answer, bytes) else json.dumps(answer).encode("utf-8")
            try:
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except BrokenPipeError:
                # The time-cap case: the caller has already given up and
                # written the source as typed, which is the point of it.
                pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, Handler


class FormatForwardTest(unittest.TestCase):
    def _where(self, server, timeout_s=8.0):
        return Formatting(url=f"http://127.0.0.1:{server.server_address[1]}", bearer=BEARER, timeout_s=timeout_s)

    def test_given_a_formatter_that_rewrote_it_then_the_new_text_is_answered(self):
        server, handler = stand_in({"source": "x = 1\n", "formatted": True})
        try:
            answer = format_source(self._where(server), "x=1\n", "python")
        finally:
            server.shutdown()
        self.assertEqual(answer, {"source": "x = 1\n", "formatted": True})
        self.assertEqual(handler.last, {"source": "x=1\n", "language": "python"})
        self.assertEqual(handler.authorization, f"Bearer {BEARER}")

    def test_given_a_formatter_that_rewrote_nothing_then_the_source_comes_back(self):
        server, _ = stand_in({"source": "if (a) {\n", "formatted": False, "reason": "prettier refused it"})
        try:
            answer = format_source(self._where(server), "if (a) {\n", "javascript")
        finally:
            server.shutdown()
        self.assertEqual(answer["source"], "if (a) {\n")
        self.assertFalse(answer["formatted"])

    def test_given_a_formatter_that_is_not_configured_then_the_source_comes_back(self):
        answer = format_source(Formatting(), "x=1\n", "python")
        self.assertEqual(answer["source"], "x=1\n")
        self.assertFalse(answer["formatted"])
        self.assertIn("no formatter", answer["reason"])

    def test_given_a_formatter_that_cannot_be_reached_then_the_source_comes_back(self):
        server, _ = stand_in({"source": "", "formatted": True})
        port = server.server_address[1]
        server.shutdown()
        server.server_close()
        answer = format_source(Formatting(url=f"http://127.0.0.1:{port}", bearer=BEARER), "x=1\n", "python")
        self.assertEqual(answer["source"], "x=1\n")
        self.assertFalse(answer["formatted"])
        self.assertIn("could not be reached", answer["reason"])

    def test_given_a_formatter_that_takes_too_long_then_the_source_comes_back(self):
        server, _ = stand_in({"source": "x = 1\n", "formatted": True}, delay=1.0)
        try:
            answer = format_source(self._where(server, timeout_s=0.05), "x=1\n", "python")
        finally:
            server.shutdown()
        self.assertEqual(answer["source"], "x=1\n")
        self.assertFalse(answer["formatted"])

    def test_given_a_formatter_that_answers_rubbish_then_the_source_comes_back(self):
        for body in (b"not json at all", json.dumps([1, 2]).encode(), json.dumps({"formatted": True}).encode(),
                     json.dumps({"source": 7, "formatted": True}).encode()):
            with self.subTest(body=body[:20]):
                server, _ = stand_in(body)
                try:
                    answer = format_source(self._where(server), "x=1\n", "python")
                finally:
                    server.shutdown()
                self.assertEqual(answer["source"], "x=1\n")
                self.assertFalse(answer["formatted"])

    def test_given_a_refusal_then_the_source_comes_back(self):
        server, _ = stand_in({"error": "the code format bearer is required"}, status=401)
        try:
            answer = format_source(self._where(server), "x=1\n", "python")
        finally:
            server.shutdown()
        self.assertEqual(answer["source"], "x=1\n")
        self.assertFalse(answer["formatted"])


if __name__ == "__main__":
    unittest.main()
