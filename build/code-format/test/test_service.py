"""The front, over a real socket: the bearer, the routes, and the promise.

The service is started in this process on a port of the operating system's
choosing and spoken to over HTTP, so what is proven is what a caller gets.
BO_0296_001
"""

import json
import os
import tempfile
import unittest
import urllib.error
import urllib.request

from lib.caps import Caps
from server import Service, read_bearer

BEARER = "a-test-bearer"


def call(port, path, body=None, bearer=BEARER, method=None):
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        method=method or ("POST" if body is not None else "GET"),
    )
    if bearer is not None:
        request.add_header("Authorization", f"Bearer {bearer}")
    if body is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=30) as answer:
            return answer.status, json.loads(answer.read() or b"{}")
    except urllib.error.HTTPError as refused:
        return refused.code, json.loads(refused.read() or b"{}")


class ServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service = Service(Caps(), BEARER, 0)
        cls.port = cls.service.port
        cls.service.serve_in_thread()

    @classmethod
    def tearDownClass(cls):
        cls.service.shutdown()

    def test_given_no_bearer_then_health_answers_and_nothing_else_does(self):
        status, body = call(self.port, "/health", bearer=None)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")
        status, body = call(self.port, "/v1/format", {"source": "x=1\n", "language": "python"}, bearer=None)
        self.assertEqual(status, 401)
        status, _ = call(self.port, "/v1/format", {"source": "x=1\n", "language": "python"}, bearer="wrong")
        self.assertEqual(status, 401)

    def test_given_python_then_it_is_rewritten(self):
        status, body = call(self.port, "/v1/format", {"source": "def f(a,b):\n  return a+b\n", "language": "python"})
        self.assertEqual(status, 200)
        self.assertTrue(body["formatted"])
        self.assertEqual(body["source"], "def f(a, b):\n    return a + b\n")

    def test_given_a_fragment_then_it_comes_back_exactly(self):
        fragment = "def f(a,b):\n  return a+\n"
        status, body = call(self.port, "/v1/format", {"source": fragment, "language": "python"})
        self.assertEqual(status, 200)
        self.assertFalse(body["formatted"])
        self.assertEqual(body["source"], fragment)

    def test_given_an_unknown_language_then_it_comes_back_exactly(self):
        source = "SELECT  1\n"
        status, body = call(self.port, "/v1/format", {"source": source, "language": "sql"})
        self.assertEqual(status, 200)
        self.assertFalse(body["formatted"])
        self.assertEqual(body["source"], source)

    def test_given_no_language_then_it_comes_back_exactly(self):
        source = "x=1\n"
        status, body = call(self.port, "/v1/format", {"source": source})
        self.assertEqual(status, 200)
        self.assertFalse(body["formatted"])
        self.assertEqual(body["source"], source)

    def test_given_a_bad_body_then_the_caller_is_told_in_words(self):
        status, body = call(self.port, "/v1/format", {"language": "python"})
        self.assertEqual(status, 400)
        self.assertIn("source", body["error"])
        status, body = call(self.port, "/v1/format", {"source": 1, "language": "python"})
        self.assertEqual(status, 400)
        status, body = call(self.port, "/v1/format", {"source": "x=1\n", "language": 7})
        self.assertEqual(status, 400)

    def test_given_another_route_or_method_then_it_is_refused_in_words(self):
        status, body = call(self.port, "/v1/nothing")
        self.assertEqual(status, 404)
        status, body = call(self.port, "/v1/format")
        self.assertEqual(status, 405)

    def test_given_the_languages_route_then_it_names_what_it_formats(self):
        status, body = call(self.port, "/v1/languages")
        self.assertEqual(status, 200)
        self.assertIn("python", body["languages"])
        self.assertIn("typescript", body["languages"])


class BearerTest(unittest.TestCase):
    """Where the bearer comes from (BO_0296_010): the entrypoint's environment
    first, the file otherwise, and a start with neither refused in words."""

    def test_given_the_entrypoint_handed_it_then_the_environment_wins_over_the_file(self):
        self.assertEqual(read_bearer("/nonexistent", {"CALLIOPA_CODE_FORMAT_BEARER": " handed "}), "handed")

    def test_given_no_environment_then_the_file_is_read(self):
        with tempfile.NamedTemporaryFile("w", suffix=".bearer", delete=False) as handle:
            handle.write("from-file\n")
        try:
            self.assertEqual(read_bearer(handle.name, {}), "from-file")
        finally:
            os.unlink(handle.name)

    def test_given_neither_then_the_start_is_refused_in_words(self):
        with self.assertRaises(SystemExit) as refused:
            read_bearer("/nonexistent", {})
        self.assertIn("no bearer at /nonexistent", str(refused.exception))


if __name__ == "__main__":
    unittest.main()
