"""The orchestrator against stand-in gateway and Honcho servers on local
ports: what it asks Hermes, what it keeps in a person's memory, what it lets
through of Hermes's answer, and the conclusions it lists and erases.
BO_0350_060 BO_0350_061 BO_0350_062"""

import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ["API_SERVER_KEY"] = "gateway-bearer"

import orchestrator  # noqa: E402


class StandIn:
    """One local HTTP server answering by a function of (method, path, body)."""

    def __init__(self, answer):
        self.calls = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def handle_one(self):
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length)) if length else None
                outer.calls.append((self.command, self.path, body, dict(self.headers)))
                status, reply = answer(self.command, self.path, body)
                payload = b"" if reply is None else json.dumps(reply).encode()
                self.send_response(status)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            do_GET = do_POST = do_DELETE = handle_one

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = "http://127.0.0.1:%d" % self.server.server_address[1]

    def close(self):
        self.server.shutdown()


DOCUMENTS = [
    {
        "artifact": "doc-1",
        "title": "Draft",
        "blocks": [{"id": "blk-a", "text": "Opening."}, {"id": "blk-b", "text": "The storm."}],
        "cards": [{"group": "node:run-1", "blocks": ["blk-b"]}, {"group": "node:run-2", "blocks": ["blk-a"]}],
    }
]
ACTS = [{"person": "frank", "kind": "answer", "group": "node:run-0", "answer": "accepted", "artifact": "doc-1"}]


class OrchestratorTest(unittest.TestCase):
    def setUp(self):
        self.hermes_says = "{}"
        self.gateway = StandIn(self.gateway_answer)
        self.conclusions = []
        self.honcho = StandIn(self.honcho_answer)
        orchestrator.GATEWAY_URL = self.gateway.url
        self.memory = orchestrator.Memory(self.honcho.url, "calliopa")
        orchestrator.Handler.memory = self.memory
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), orchestrator.Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = "http://127.0.0.1:%d" % self.server.server_address[1]

    def tearDown(self):
        for server in (self.gateway, self.honcho):
            server.close()
        self.server.shutdown()

    def gateway_answer(self, method, path, body):
        return 200, {"choices": [{"message": {"content": "Here it is:\n" + self.hermes_says}}]}

    def honcho_answer(self, method, path, body):
        peer = orchestrator.peer_of("frank")
        if path.endswith("/representation"):
            return 200, {"representation": "Frank keeps short openings."}
        if "/conclusions/list" in path:
            return 200, {"items": self.conclusions}
        if method == "DELETE" and "/conclusions/" in path:
            self.conclusions = [c for c in self.conclusions if not path.endswith("/" + c["id"])]
            return 204, None
        return 200, {"id": peer}

    def request(self, method, path, body=None, bearer="gateway-bearer"):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.url + path, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        if bearer:
            request.add_header("Authorization", "Bearer " + bearer)
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = response.read()
                return response.status, json.loads(payload) if payload else None
        except urllib.error.HTTPError as error:
            payload = error.read()
            return error.code, json.loads(payload) if payload else None

    def test_an_orchestration_asks_hermes_with_the_persons_memory_and_keeps_only_what_it_was_shown(self):
        self.hermes_says = json.dumps({
            "prepare": [
                {"artifact": "doc-1", "block": "blk-b", "pinch": "in", "agent": "codex"},
                {"artifact": "doc-1", "block": "blk-nowhere", "pinch": "in", "agent": "codex"},
                {"artifact": "doc-1", "block": "blk-a", "pinch": "out", "agent": "hermes"},
                {"artifact": "doc-1", "block": "blk-a", "pinch": "in", "agent": "claude-code", "group": "node:run-2", "item": "node:run-2|replace|node:blk-a", "revision": "rev-x"},
            ],
            "withdraw": ["arun-old", 3],
            "arrangement": {"artifact": "doc-1", "cards": ["node:run-2", "node:run-gone", "node:run-1"], "collapsed": ["blk-a", "blk-z"], "dimmed": []},
            "forward": ["doc-1", "doc-unknown"],
        })
        status, answer = self.request("POST", "/v1/orchestrate", {"person": "frank", "acts": ACTS, "documents": DOCUMENTS})
        self.assertEqual(status, 200)
        self.assertEqual(answer["prepare"], [
            {"artifact": "doc-1", "block": "blk-b", "pinch": "in", "agent": "codex", "speed": "fast"},
            {"artifact": "doc-1", "block": "blk-a", "pinch": "in", "agent": "claude-code", "speed": "fast", "group": "node:run-2", "item": "node:run-2|replace|node:blk-a", "revision": "rev-x"},
        ])
        self.assertEqual(answer["withdraw"], ["arun-old"])
        self.assertEqual(answer["arrangement"], {"artifact": "doc-1", "cards": ["node:run-2", "node:run-1"], "collapsed": ["blk-a"], "dimmed": []})
        self.assertEqual(answer["forward"], ["doc-1"])

        # Hermes was asked with the memory key of this person alone, and told
        # what Honcho knows of them.
        method, path, body, headers = self.gateway.calls[-1]
        self.assertEqual(path, "/v1/chat/completions")
        self.assertEqual(headers.get("X-Hermes-Session-Key"), "orchestrate-" + orchestrator.peer_of("frank"))
        self.assertIn("Frank keeps short openings.", body["messages"][1]["content"])
        self.assertIn("Do not call any tool", body["messages"][0]["content"])
        # The acts went into the person's session as lines to learn from.
        messages = [call for call in self.honcho.calls if call[1].endswith("/messages")]
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0][2]["messages"][0]["content"], "Accepted a card in doc-1 (group node:run-0)")
        self.assertNotIn("frank", json.dumps([call[1] for call in self.honcho.calls]))

    def test_an_answer_that_is_not_json_prepares_and_arranges_nothing(self):
        self.hermes_says = "I would rather not."
        status, answer = self.request("POST", "/v1/orchestrate", {"person": "frank", "acts": ACTS, "documents": DOCUMENTS})
        self.assertEqual((status, answer), (200, {"prepare": [], "withdraw": [], "arrangement": None, "forward": []}))

    def test_the_learned_conclusions_are_the_persons_own_and_one_is_erased(self):
        peer = orchestrator.peer_of("frank")
        self.conclusions = [
            {"id": "c-1", "content": "Prefers short openings.", "observed_id": peer, "created_at": "2026-10-05T10:00:00Z"},
            {"id": "c-2", "content": "Someone else's.", "observed_id": "p-other", "created_at": "2026-10-05T10:01:00Z"},
        ]
        status, answer = self.request("GET", "/v1/learned?person=frank")
        self.assertEqual(status, 200)
        self.assertEqual(answer, {"memory": "on", "learned": [{"id": "c-1", "words": "Prefers short openings.", "at": "2026-10-05T10:00:00Z"}]})
        self.assertEqual(self.request("DELETE", "/v1/learned/c-2?person=frank")[0], 404)
        self.assertEqual(self.request("DELETE", "/v1/learned/c-1?person=frank")[0], 204)
        self.assertEqual(self.request("GET", "/v1/learned?person=frank")[1]["learned"], [])

    def test_every_route_but_health_wants_the_bearer(self):
        self.assertEqual(self.request("POST", "/v1/orchestrate", {"person": "frank", "acts": []}, bearer="wrong")[0], 401)
        self.assertEqual(self.request("GET", "/v1/learned?person=frank", bearer=None)[0], 401)
        self.assertEqual(self.request("GET", "/health", bearer=None)[0], 200)

    def test_with_no_honcho_the_memory_is_off_and_hermes_still_answers(self):
        orchestrator.Handler.memory = orchestrator.Memory("", "calliopa")
        self.hermes_says = json.dumps({"forward": ["doc-1"]})
        status, answer = self.request("POST", "/v1/orchestrate", {"person": "frank", "acts": ACTS, "documents": DOCUMENTS})
        self.assertEqual((status, answer["forward"]), (200, ["doc-1"]))
        self.assertEqual(self.request("GET", "/v1/learned?person=frank")[1], {"memory": "off", "learned": []})
        self.assertEqual(self.honcho.calls, [])


if __name__ == "__main__":
    unittest.main()
