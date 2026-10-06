"""An instruction tool's call against the real daemon: a throwaway container from the runtime's image,
off every network or on the runtimes' network, its environment and input read, and nothing of it
left after a success, a failure or a timeout. No mocks; the socket must be reachable and the
service must run in its own image, since the driver is started from it. BO_0311_001"""

from __future__ import annotations

import os
import unittest

import docker

from lib.caps import Caps
from lib.runtimes import LABEL, SCOPE_LABEL
from server import Service
from test.test_service import BEARER, KERNEL_IMAGE, Api, ensure_kernel_image, remove_network

REACH = """
import socket
try:
    socket.create_connection(("pypi.org", 443), timeout=5).close()
    print("reached")
except OSError as failure:
    print("refused", type(failure).__name__)
"""


class CallsTest(unittest.TestCase):
    client: docker.DockerClient
    service: Service
    api: Api
    runtime: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = docker.from_env()
        ensure_kernel_image(cls.client)
        cls.caps = Caps(output_max_bytes=4096, execution_timeout_s=8.0, max_runtimes=3, memory_bytes=512 * 1024**2, cpus=1.0)
        cls.scope = "test-" + os.urandom(4).hex()
        cls.service = Service(cls.client, cls.caps, BEARER, 0, scope=cls.scope)
        cls.service.prepare()
        cls.service.serve_in_thread()
        cls.api = Api(cls.service.port)
        status, record, _ = cls.api.call("POST", "/v1/runtimes", {"name": "call kernel", "image": KERNEL_IMAGE})
        assert status == 202, record
        cls.runtime = record["id"]
        record = cls.service.runtimes.wait_until(cls.runtime, "running", 180)
        assert record["state"] == "running", record

    @classmethod
    def tearDownClass(cls) -> None:
        for container in cls.client.containers.list(all=True, filters={"label": f"{SCOPE_LABEL}={cls.scope}"}):
            container.remove(force=True)
            try:
                cls.client.volumes.get("calliopa-code-" + container.labels.get(f"{LABEL}.id", "")).remove(force=True)
            except docker.errors.NotFound:
                pass
        cls.service.shutdown()
        remove_network(cls.service)

    def call(self, code: str, network: str = "none", value=None, env=None):
        return self.api.call("POST", "/v1/calls", {"runtime": self.runtime, "code": code, "input": value, "network": network, "env": env or {}})

    def text(self, body) -> str:
        return "".join(event.get("text", "") for event in body["outputs"] if event["event"] == "stream")

    def leftovers(self) -> list:
        return [c for c in self.client.containers.list(all=True, filters={"label": f"{SCOPE_LABEL}={self.scope}"})
                if c.labels.get(LABEL) in ("call", "call-driver")]

    def test_01_a_none_call_reaches_nothing_and_a_runtimes_call_reaches_out(self):
        status, body, _ = self.call(REACH, "none")
        self.assertEqual(status, 200, body)
        self.assertEqual(body["status"], "ok", body)
        self.assertEqual(body["network"], "none")
        self.assertTrue(self.text(body).startswith("refused"), body)
        status, body, _ = self.call(REACH, "runtimes")
        self.assertEqual(status, 200, body)
        self.assertEqual(self.text(body).strip(), "reached", body)
        self.assertEqual(self.leftovers(), [])

    def test_02_the_environment_and_the_input_are_read(self):
        code = "import json, os\nprint(os.environ['SMTP'])\nprint(json.load(open(os.environ['CALLIOPA_INPUT']))['to'])\n6 * 7"
        status, body, _ = self.call(code, value={"to": "ada@example.org"}, env={"SMTP": "s3cret"})
        self.assertEqual(status, 200, body)
        self.assertEqual(self.text(body), "s3cret\nada@example.org\n")
        result = [event for event in body["outputs"] if event["event"] == "result"]
        self.assertEqual(result[0]["data"]["text/plain"], "42")
        self.assertEqual(self.leftovers(), [])

    def test_03_a_failure_and_a_timeout_leave_nothing_behind(self):
        status, body, _ = self.call("raise ValueError('no mail server')")
        self.assertEqual(status, 200, body)
        self.assertEqual(body["status"], "error")
        errors = [event for event in body["outputs"] if event["event"] == "error"]
        self.assertEqual((errors[0]["name"], errors[0]["value"]), ("ValueError", "no mail server"))
        self.assertEqual(self.leftovers(), [])
        status, body, _ = self.call("import time\ntime.sleep(60)")
        self.assertEqual(status, 200, body)
        self.assertEqual(body["status"], "timed out")
        self.assertEqual(self.leftovers(), [])

    def test_04_a_call_touches_no_session_of_the_runtime(self):
        self.call("open('/calliopa/left.txt', 'w').write('x')")
        container = self.service.runtimes.container(self.runtime)
        listing = container.exec_run(["ls", "/calliopa"]).output.decode()
        self.assertNotIn("left.txt", listing)
        self.assertEqual(self.service.sessions.list(self.runtime), [])

    def test_05_refusals_in_words(self):
        status, body, _ = self.api.call("POST", "/v1/calls", {"runtime": "deadbeef", "code": "1", "network": "none"})
        self.assertEqual(status, 409)
        self.assertIn("no runtime deadbeef", body["error"])
        status, body, _ = self.api.call("POST", "/v1/calls", {"runtime": self.runtime, "code": "1", "network": "host"})
        self.assertEqual(status, 400)
        status, body, _ = self.api.call("POST", "/v1/calls", {"runtime": self.runtime, "code": "1", "network": "none", "env": {"1X": "y"}})
        self.assertEqual(status, 400)
        status, body, _ = self.api.call("POST", "/v1/calls", bearer=None)
        self.assertEqual(status, 401)

    def test_06_a_stopped_runtime_is_refused(self):
        self.api.call("POST", f"/v1/runtimes/{self.runtime}/stop")
        try:
            status, body, _ = self.call("1")
            self.assertEqual(status, 409)
            self.assertIn("not running", body["error"])
        finally:
            self.api.call("POST", f"/v1/runtimes/{self.runtime}/start")


if __name__ == "__main__":
    unittest.main()
