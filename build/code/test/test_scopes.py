"""Two services on one daemon keep their runtimes apart: neither lists, counts, reaps nor reaches
what the other made, and each stands on a runtimes' network of its own. Against the real daemon,
no mocks, in two scopes of the test's own — never `calliopa` or `stack`, which are the instance's.
BO_0353_001 BO_0353_002"""

from __future__ import annotations

import os
import time
import unittest

import docker

from lib.caps import Caps
from lib.runtimes import DEFAULT_SCOPE, INSTANCE_SCOPE, LABEL, NETWORK_LABEL, SCOPE_LABEL, owns, resolve_scope
from server import Service
from test.test_service import BEARER, KERNEL_IMAGE, ensure_kernel_image, remove_network

PROBE = """
import socket, sys
try:
    socket.create_connection((sys.argv[1], 8000), timeout=3).close()
    print('reached')
except OSError as failure:
    print('unreachable', type(failure).__name__)
"""


class OwnershipTest(unittest.TestCase):
    def test_a_scope_owns_its_own_label_alone(self):
        self.assertTrue(owns("calliopa-graph", "calliopa-graph"))
        self.assertFalse(owns("calliopa-graph", "calliopa"))
        self.assertFalse(owns("calliopa-graph", DEFAULT_SCOPE))
        self.assertFalse(owns("calliopa-graph", None))

    def test_the_instance_owns_what_was_made_before_the_scope_followed_the_project(self):
        self.assertTrue(owns(INSTANCE_SCOPE, INSTANCE_SCOPE))
        self.assertTrue(owns(INSTANCE_SCOPE, DEFAULT_SCOPE))
        self.assertTrue(owns(INSTANCE_SCOPE, None))
        self.assertFalse(owns(INSTANCE_SCOPE, "calliopa-graph"))

    def test_the_variable_overrides_the_project(self):
        self.assertEqual(resolve_scope(docker.from_env(), "chosen"), "chosen")


class TwoScopesTest(unittest.TestCase):
    client: docker.DockerClient

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = docker.from_env()
        ensure_kernel_image(cls.client)
        caps = Caps(execution_timeout_s=30.0, max_runtimes=1, memory_bytes=512 * 1024**2, cpus=1.0)
        tag = os.urandom(4).hex()
        cls.scopes = (f"test-a-{tag}", f"test-b-{tag}")
        cls.services = [Service(cls.client, caps, BEARER, 0, scope=scope) for scope in cls.scopes]
        cls.runtimes = []
        for service in cls.services:
            service.prepare()
            record = service.runtimes.create("scope test", KERNEL_IMAGE)
            record = service.runtimes.wait_until(record["id"], "running", 180)
            assert record["state"] == "running", record
            cls.runtimes.append(record["id"])

    @classmethod
    def tearDownClass(cls) -> None:
        for scope in cls.scopes:
            for container in cls.client.containers.list(all=True, filters={"label": f"{SCOPE_LABEL}={scope}"}):
                container.remove(force=True)
                try:
                    cls.client.volumes.get("calliopa-code-" + container.labels.get(f"{LABEL}.id", "")).remove(force=True)
                except docker.errors.NotFound:
                    pass
        for service in cls.services:
            service.server.server_close()
            remove_network(service)

    def container(self, index: int):
        return self.client.containers.get("calliopa-code-" + self.runtimes[index])

    def test_each_scope_stands_on_a_network_of_its_own(self):
        a, b = (service.runtimes.network for service in self.services)
        self.assertNotEqual(a.id, b.id)
        self.assertEqual(a.name, f"calliopa-code-runtimes-{self.scopes[0]}")
        self.assertEqual(a.attrs["Labels"], {NETWORK_LABEL: "runtimes", SCOPE_LABEL: self.scopes[0]})
        for index, network in enumerate((a, b)):
            self.assertEqual(list(self.container(index).attrs["NetworkSettings"]["Networks"]), [network.name])

    def test_neither_lists_nor_counts_the_others_runtime(self):
        for index, service in enumerate(self.services):
            listed = [record["id"] for record in service.runtimes.list()]
            self.assertEqual(listed, [self.runtimes[index]])
        # The cap of one is this scope's own runtime alone, not the other's.
        refused = None
        try:
            self.services[0].runtimes.create("one too many", KERNEL_IMAGE)
        except Exception as failure:  # noqa: BLE001 - the refusal is what is asserted
            refused = failure
        self.assertIsNotNone(refused)

    def test_a_restart_of_one_leaves_the_others_kernel_and_call_standing(self):
        other = self.container(1)
        other.exec_run(["sh", "-c", "mkdir -p /tmp/calliopa-sessions; sleep 600 & echo $! > /tmp/calliopa-sessions/s-x.pid"], user="root")
        call = self.client.containers.run(
            KERNEL_IMAGE, ["sleep", "600"], detach=True, network_mode="none",
            labels={LABEL: "call", SCOPE_LABEL: self.scopes[1], f"{LABEL}.call": "c-scope"},
        )
        try:
            self.services[0].prepare()
            time.sleep(1)
            self.assertIn(b"s-x.pid", other.exec_run(["ls", "/tmp/calliopa-sessions"]).output)
            call.reload()
            self.assertEqual(call.status, "running")
        finally:
            call.remove(force=True)

    def test_a_runtime_of_one_cannot_reach_a_runtime_of_the_other(self):
        target = self.container(1)
        target.exec_run(["python3", "-m", "http.server", "8000"], detach=True)
        address = target.attrs["NetworkSettings"]["Networks"][self.services[1].runtimes.network.name]["IPAddress"]
        time.sleep(1)
        across = self.container(0).exec_run(["python3", "-c", PROBE, address]).output.decode()
        self.assertIn("unreachable", across)
        # The same address answers from the other scope's own network, so the refusal is the networks'.
        beside = self.client.containers.run(
            KERNEL_IMAGE, ["python3", "-c", PROBE, address], network=self.services[1].runtimes.network.name,
            remove=True, labels={SCOPE_LABEL: self.scopes[1]},
        ).decode()
        self.assertIn("reached", beside)

    def test_a_runtime_on_another_network_is_moved_onto_its_scopes_when_started(self):
        runtimes = self.services[0].runtimes
        container = self.container(0)
        foreign = self.services[1].runtimes.network
        runtimes.stop(self.runtimes[0])
        runtimes.network.disconnect(container, force=True)
        foreign.connect(container)
        runtimes.start(self.runtimes[0])
        container.reload()
        self.assertEqual(list(container.attrs["NetworkSettings"]["Networks"]), [runtimes.network.name])


if __name__ == "__main__":
    unittest.main()
