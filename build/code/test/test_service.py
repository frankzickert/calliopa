"""The service against the real daemon: a kernelspec image built here, runtimes made, sessions
spoken to, executions streamed, files in and out, the runtimes' network holding. No mocks; the
docker socket must be reachable, and the daemon must reach the registry for the kernel image's
one build. BO_0289_005"""

from __future__ import annotations

import http.client
import io
import json
import os
import tarfile
import tempfile
import threading
import time
import unittest

import docker

from lib.caps import Caps
from lib.runtimes import LABEL, SCOPE_LABEL
from server import Service

KERNEL_IMAGE = "calliopa-code-test-kernel:ipykernel-7.3.0"
BARE_IMAGE = "python:3.13-slim"
KERNEL_DOCKERFILE = f"""
FROM {BARE_IMAGE}
RUN pip install --no-cache-dir --disable-pip-version-check ipykernel==7.3.0
"""
PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
BEARER = "test-bearer-" + os.urandom(8).hex()


def ensure_kernel_image(client: docker.DockerClient) -> None:
    try:
        client.images.get(KERNEL_IMAGE)
    except docker.errors.ImageNotFound:
        client.images.build(fileobj=io.BytesIO(KERNEL_DOCKERFILE.encode()), tag=KERNEL_IMAGE, rm=True)


class Api:
    """The service over HTTP, as the kernel would call it."""

    def __init__(self, port: int) -> None:
        self.port = port

    def call(self, method: str, path: str, body=None, bearer: str | None = BEARER, raw: bytes | None = None,
             content_type: str = "application/json"):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=180)
        headers = {}
        if bearer is not None:
            headers["Authorization"] = "Bearer " + bearer
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        if data is not None:
            headers["Content-Type"] = content_type
        connection.request(method, path, body=data, headers=headers)
        response = connection.getresponse()
        payload = response.read()
        connection.close()
        try:
            parsed = json.loads(payload) if payload else None
        except json.JSONDecodeError:
            parsed = payload
        return response.status, parsed, dict(response.getheaders())

    def execute(self, session: str, code: str, collect: bool = True, on_event=None) -> tuple[list[dict], dict]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=180)
        connection.request("POST", f"/v1/sessions/{session}/execute", body=json.dumps({"code": code, "collect": collect}).encode(),
                           headers={"Authorization": "Bearer " + BEARER, "Content-Type": "application/json"})
        response = connection.getresponse()
        assert response.status == 200, response.read()
        events: list[dict] = []
        done: dict = {}
        while True:
            line = response.readline()
            if not line:
                break
            line = line.decode().rstrip("\n")
            if not line.startswith("data: "):
                continue
            event = json.loads(line[6:])
            if on_event:
                on_event(event)
            if event["event"] == "done":
                done = event
                break
            events.append(event)
        connection.close()
        return events, done


class ServiceTest(unittest.TestCase):
    client: docker.DockerClient
    service: Service
    api: Api
    runtime: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = docker.from_env()
        ensure_kernel_image(cls.client)
        # The cap counts every runtime the daemon holds, an instance's own
        # included, so the test's cap is two above what is already there.
        cls.caps = Caps(output_max_bytes=4096, execution_timeout_s=30.0, max_runtimes=2, memory_bytes=512 * 1024**2, cpus=1.0)
        # A scope of the test's own: the instance's runtimes on the same
        # daemon are neither listed, counted nor reaped by this service.
        cls.scope = "test-" + os.urandom(4).hex()
        cls.service = Service(cls.client, cls.caps, BEARER, 0, scope=cls.scope)
        cls.service.prepare()
        cls.service.serve_in_thread()
        cls.api = Api(cls.service.port)
        status, record, _ = cls.api.call("POST", "/v1/runtimes", {"name": "test kernel", "image": KERNEL_IMAGE})
        assert status == 202, record
        cls.runtime = record["id"]
        record = cls.service.runtimes.wait_until(cls.runtime, "running", 180)
        assert record["state"] == "running", record

    @classmethod
    def tearDownClass(cls) -> None:
        for container in cls.client.containers.list(all=True, filters={"label": f"{SCOPE_LABEL}={cls.scope}"}):
            if True:
                container.remove(force=True)
                try:
                    cls.client.volumes.get("calliopa-code-" + container.labels[f"{LABEL}.id"]).remove(force=True)
                except docker.errors.NotFound:
                    pass
        cls.service.shutdown()

    # -- the front -----------------------------------------------------------

    def test_01_health_is_open_and_everything_else_needs_the_bearer(self):
        status, body, _ = self.api.call("GET", "/health", bearer=None)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")
        self.assertTrue(body["docker"])
        for method, path in (("GET", "/v1/runtimes"), ("POST", "/v1/runtimes"), ("GET", "/v1/sessions")):
            status, body, _ = self.api.call(method, path, bearer=None)
            self.assertEqual(status, 401, (method, path))
            self.assertEqual(body["error"], "the code bearer is required")
        status, body, _ = self.api.call("GET", "/v1/runtimes", bearer="wrong")
        self.assertEqual(status, 401)
        status, body, _ = self.api.call("GET", "/v1/nothing")
        self.assertEqual(status, 404)
        status, body, _ = self.api.call("PUT", "/v1/runtimes")
        self.assertEqual(status, 405)

    # -- runtimes --------------------------------------------------------------

    def test_02_the_runtime_runs_bounded_on_the_runtimes_network_alone(self):
        status, record, _ = self.api.call("GET", f"/v1/runtimes/{self.runtime}")
        self.assertEqual(status, 200)
        self.assertEqual(record["state"], "running")
        self.assertEqual(record["kernelspec"]["name"], "python3")
        self.assertEqual(record["kernelspec"]["language"], "python")
        self.assertEqual(record["image"], KERNEL_IMAGE)
        self.assertTrue(record["startedAt"])
        container = self.client.containers.get("calliopa-code-" + self.runtime)
        networks = container.attrs["NetworkSettings"]["Networks"]
        self.assertEqual(list(networks), [self.service.runtimes.network.name])
        self.assertEqual(container.attrs["HostConfig"]["Memory"], 512 * 1024**2)
        self.assertEqual(container.attrs["HostConfig"]["NanoCpus"], 10**9)
        self.assertEqual(container.attrs["NetworkSettings"]["Ports"], {})
        self.assertEqual((container.attrs["Config"].get("Healthcheck") or {}).get("Test"), ["NONE"])
        mounts = [m for m in container.attrs["Mounts"] if m["Destination"] == "/calliopa"]
        self.assertEqual(len(mounts), 1)
        self.assertEqual(mounts[0]["Name"], "calliopa-code-" + self.runtime)
        self.assertFalse(any("docker.sock" in m.get("Source", "") for m in container.attrs["Mounts"]))
        status, listing, _ = self.api.call("GET", "/v1/runtimes")
        self.assertIn(self.runtime, [r["id"] for r in listing["runtimes"]])

    def test_02b_another_scopes_runtime_is_neither_listed_nor_reaped(self):
        # The stack's runtimes share the daemon with a test's: a runtime of
        # another scope, with a stale pid file of its own, is left alone.
        other = self.client.containers.run(
            BARE_IMAGE, ["sh", "-c", "mkdir -p /tmp/calliopa-sessions && echo 1 > /tmp/calliopa-sessions/s-x.pid && sleep 300"],
            detach=True, labels={LABEL: "runtime", SCOPE_LABEL: "other-" + self.scope, f"{LABEL}.id": "deadbeef", f"{LABEL}.name": "test other scope"},
            network_mode="none",
        )
        try:
            status, listing, _ = self.api.call("GET", "/v1/runtimes")
            self.assertNotIn("deadbeef", [r["id"] for r in listing["runtimes"]])
            status, body, _ = self.api.call("GET", "/v1/runtimes/deadbeef")
            self.assertEqual(status, 404)
            self.assertEqual(self.service.runtimes.reap_stale_kernels("/tmp/calliopa-sessions"), 0)
            time.sleep(1)
            self.assertIn(b"s-x.pid", other.exec_run(["ls", "/tmp/calliopa-sessions"]).output)
        finally:
            other.remove(force=True)

    def test_03_an_image_with_no_kernelspec_fails_in_words_and_the_cap_holds(self):
        status, record, _ = self.api.call("POST", "/v1/runtimes", {"name": "test bare", "image": BARE_IMAGE})
        self.assertEqual(status, 202)
        self.assertEqual(record["state"], "pulling")
        status, third, _ = self.api.call("POST", "/v1/runtimes", {"name": "test third", "image": KERNEL_IMAGE})
        self.assertEqual(status, 503)
        self.assertIn("the runtime cap of 2 is reached", third["error"])
        failed = self.service.runtimes.wait_until(record["id"], "running", 120)
        self.assertEqual(failed["state"], "failed")
        self.assertEqual(failed["error"], "the image carries no Jupyter kernelspec")
        status, body, _ = self.api.call("POST", f"/v1/runtimes/{record['id']}/sessions")
        self.assertEqual(status, 409)
        status, body, _ = self.api.call("DELETE", f"/v1/runtimes/{record['id']}")
        self.assertEqual(status, 200)
        status, body, _ = self.api.call("GET", f"/v1/runtimes/{record['id']}")
        self.assertEqual(status, 404)
        status, body, _ = self.api.call("POST", "/v1/runtimes", {"name": "", "image": KERNEL_IMAGE})
        self.assertEqual(status, 400)
        status, body, _ = self.api.call("POST", "/v1/runtimes", {"name": "test x", "image": "two words"})
        self.assertEqual(status, 400)

    # -- sessions and executions ------------------------------------------------

    def test_04_a_session_holds_state_and_every_output_kind_streams_typed(self):
        status, session, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        self.assertEqual(status, 201, session)
        self.assertEqual(session["state"], "ready")
        self.assertEqual(session["language"], "python")
        sid = session["id"]
        events, done = self.api.execute(sid, "x = 41")
        self.assertEqual(done["status"], "ok")
        self.assertEqual(events, [])
        events, done = self.api.execute(sid, "print(x + 1)")
        self.assertEqual(done["status"], "ok")
        self.assertEqual([(e["event"], e["name"], e["text"]) for e in events], [("stream", "stdout", "42\n")])
        events, done = self.api.execute(sid, "x + 1")
        self.assertEqual(events[0]["event"], "result")
        self.assertEqual(events[0]["data"]["text/plain"], "42")
        self.assertEqual(done["executionCount"], events[0]["executionCount"])
        events, done = self.api.execute(sid, "1 / 0")
        self.assertEqual(done["status"], "error")
        self.assertEqual(events[-1]["event"], "error")
        self.assertEqual(events[-1]["name"], "ZeroDivisionError")
        self.assertTrue(any("ZeroDivisionError" in line for line in events[-1]["traceback"]))
        events, done = self.api.execute(
            sid, f"import base64\nfrom IPython.display import display, Image, HTML\n"
                 f"display(Image(data=base64.b64decode('{PNG}')))\ndisplay(HTML('<b>bold</b>'))"
        )
        self.assertEqual(done["status"], "ok")
        self.assertEqual([e["event"] for e in events], ["display", "display"])
        self.assertEqual(events[0]["data"]["image/png"].strip(), PNG)
        self.assertEqual(events[1]["data"]["text/html"], "<b>bold</b>")
        events, done = self.api.execute(sid, "import sys; print('err', file=sys.stderr)")
        self.assertEqual([(e["name"], e["text"]) for e in events], [("stderr", "err\n")])
        status, listing, _ = self.api.call("GET", f"/v1/runtimes/{self.runtime}/sessions")
        self.assertEqual([s["id"] for s in listing["sessions"]], [sid])
        self.assertEqual(listing["sessions"][0]["executions"], 6)
        status, record, _ = self.api.call("GET", f"/v1/runtimes/{self.runtime}")
        self.assertTrue(record["lastUsedAt"] >= record["startedAt"])
        status, body, _ = self.api.call("DELETE", f"/v1/sessions/{sid}")
        self.assertEqual(status, 200)
        status, body, _ = self.api.call("GET", f"/v1/sessions/{sid}")
        self.assertEqual(status, 404)

    def test_05_an_interrupt_ends_a_sleep_and_the_session_goes_on(self):
        _, session, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        sid = session["id"]
        seen = threading.Event()

        def interrupt_soon():
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                status, record, _ = self.api.call("GET", f"/v1/sessions/{sid}")
                if record["running"]:
                    break
                time.sleep(0.1)
            time.sleep(0.5)
            status, body, _ = self.api.call("POST", f"/v1/sessions/{sid}/interrupt")
            seen.set()
            assert body == {"interrupted": True}, body

        threading.Thread(target=interrupt_soon, daemon=True).start()
        started = time.monotonic()
        events, done = self.api.execute(sid, "import time\ntime.sleep(30)\nprint('never')")
        self.assertTrue(seen.is_set())
        self.assertEqual(done["status"], "interrupted")
        self.assertLess(time.monotonic() - started, 10)
        self.assertEqual([e["event"] for e in events], ["error"])
        self.assertEqual(events[0]["name"], "KeyboardInterrupt")
        events, done = self.api.execute(sid, "print('after')")
        self.assertEqual(done["status"], "ok")
        self.assertEqual(events[0]["text"], "after\n")
        status, body, _ = self.api.call("POST", f"/v1/sessions/{sid}/interrupt")
        self.assertEqual(body, {"interrupted": False})
        self.api.call("DELETE", f"/v1/sessions/{sid}")

    def test_05b_a_kernel_that_ends_mid_execution_ends_the_execution_at_once(self):
        _, session, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        sid = session["id"]
        container = self.client.containers.get("calliopa-code-" + self.runtime)

        def kill_soon():
            time.sleep(1.5)
            container.exec_run(["sh", "-c", f"kill -KILL $(cat /tmp/calliopa-sessions/{sid}.pid)"], user="root")

        threading.Thread(target=kill_soon, daemon=True).start()
        started = time.monotonic()
        events, done = self.api.execute(sid, "import time\ntime.sleep(30)")
        self.assertEqual(done["status"], "the kernel ended", (done, events))
        self.assertLess(time.monotonic() - started, 8)
        status, record, _ = self.api.call("GET", f"/v1/sessions/{sid}")
        self.assertEqual(record["state"], "dead")
        self.assertFalse(record["kernelRunning"])
        status, body, _ = self.api.call("POST", f"/v1/sessions/{sid}/interrupt")
        self.assertEqual(body, {"interrupted": False})
        events, done = self.api.execute(sid, "print(1)")
        self.assertEqual(done["status"], "refused")
        self.assertIn("its kernel has ended", done["error"])
        self.api.call("DELETE", f"/v1/sessions/{sid}")
        _, fresh, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        events, done = self.api.execute(fresh["id"], "print('again')")
        self.assertEqual(events[0]["text"], "again\n")
        self.api.call("DELETE", f"/v1/sessions/{fresh['id']}")

    def test_06_the_output_cap_and_the_time_cap_each_end_an_execution_with_the_reason(self):
        _, session, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        sid = session["id"]
        events, done = self.api.execute(sid, "for i in range(100000):\n    print('line', i, 'x' * 60)")
        self.assertEqual(done["status"], "output cap")
        self.assertTrue(any(e["event"] == "cut" and e["reason"] == "output cap" for e in events))
        self.assertLess(len(json.dumps([e for e in events if e["event"] == "stream"])), 4096 + 2000)
        started = time.monotonic()
        events, done = self.api.execute(sid, "import time\ntime.sleep(60)")
        self.assertEqual(done["status"], "timed out")
        self.assertLess(time.monotonic() - started, 30 + 12)
        events, done = self.api.execute(sid, "print('still here')")
        self.assertEqual(done["status"], "ok")
        self.api.call("DELETE", f"/v1/sessions/{sid}")

    # -- files -------------------------------------------------------------------

    def test_07_files_go_in_and_what_the_code_wrote_comes_back(self):
        _, session, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        sid = session["id"]
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as tar:
            for name, content in (("data.txt", b"three\nlines\nhere\n"), ("sub/table.csv", b"a,b\n1,2\n")):
                info = tarfile.TarInfo(name)
                info.size = len(content)
                info.mtime = int(time.time())
                info.mode = 0o644
                tar.addfile(info, io.BytesIO(content))
        status, body, _ = self.api.call("PUT", f"/v1/sessions/{sid}/files", raw=buffer.getvalue(), content_type="application/x-tar")
        self.assertEqual(status, 200, body)
        self.assertEqual(body["files"], 2)
        events, done = self.api.execute(
            sid, "import pathlib\nprint(len(pathlib.Path('data.txt').read_text().splitlines()))\n"
                 "pathlib.Path('out.txt').write_text('written')\npathlib.Path('sub/more.csv').write_text('c\\n3\\n')\n"
                 "pathlib.Path('__pycache__').mkdir(exist_ok=True)\npathlib.Path('__pycache__/x.pyc').write_bytes(b'x')\n"
        )
        self.assertEqual(done["status"], "ok", done)
        self.assertEqual(events[0]["text"], "3\n")
        self.assertEqual(
            [(f["name"], f["size"], f["mediaType"]) for f in done["files"]],
            [("out.txt", 7, "text/plain"), ("sub/more.csv", 4, "text/csv")],
        )
        self.assertFalse(done["filesTruncated"])
        connection = http.client.HTTPConnection("127.0.0.1", self.api.port, timeout=60)
        connection.request("GET", f"/v1/sessions/{sid}/files?since={done['execution']}", headers={"Authorization": "Bearer " + BEARER})
        response = connection.getresponse()
        self.assertEqual(response.status, 200)
        self.assertEqual(response.getheader("Content-Type"), "application/x-tar")
        self.assertEqual([f["name"] for f in json.loads(response.getheader("X-Calliopa-Files"))], ["out.txt", "sub/more.csv"])
        archive = response.read()
        connection.close()
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:*") as tar:
            members = {m.name: tar.extractfile(m).read() for m in tar.getmembers() if m.isfile()}
        self.assertEqual(members, {"out.txt": b"written", "sub/more.csv": b"c\n3\n"})
        events, done = self.api.execute(sid, "print(open('out.txt').read())")
        self.assertEqual(done["files"], [])
        self.assertEqual(events[0]["text"], "written\n")
        status, body, _ = self.api.call("GET", f"/v1/sessions/{sid}/files?since=x-nothing")
        self.assertEqual(status, 404)
        status, body, _ = self.api.call("PUT", f"/v1/sessions/{sid}/files", raw=b"not a tar at all", content_type="application/x-tar")
        self.assertEqual(status, 400)
        escaping = io.BytesIO()
        with tarfile.open(fileobj=escaping, mode="w") as tar:
            info = tarfile.TarInfo("../etc/evil")
            info.size = 0
            tar.addfile(info, io.BytesIO(b""))
        status, body, _ = self.api.call("PUT", f"/v1/sessions/{sid}/files", raw=escaping.getvalue(), content_type="application/x-tar")
        self.assertEqual(status, 400)
        self.assertIn("escapes", body["error"])
        self.api.call("DELETE", f"/v1/sessions/{sid}")

    # -- the network -------------------------------------------------------------

    def test_08_a_runtime_reaches_the_internet_and_nothing_of_the_stack(self):
        _, session, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        sid = session["id"]
        code = """
import os, socket, threading, urllib.request
lines = []
def probe(host, port):
    try:
        socket.create_connection((host, port), timeout=2).close()
        lines.append(f'{host} reached')
    except OSError as failure:
        lines.append(f'{host} unreachable {type(failure).__name__}')
probes = [threading.Thread(target=probe, args=pair) for pair in (('app', 8080), ('postgres', 5432), ('kernel', 8090), ('garage', 3900))]
for thread in probes: thread.start()
for thread in probes: thread.join(15)
print('\\n'.join(sorted(lines)))
print('socket', os.path.exists('/var/run/docker.sock'))
try:
    with urllib.request.urlopen('https://pypi.org/simple/pip/', timeout=20) as answer:
        print('pypi', answer.status)
except Exception as failure:
    print('pypi failed', failure)
"""
        events, done = self.api.execute(sid, code)
        text = "".join(e["text"] for e in events if e["event"] == "stream")
        self.assertEqual(done["status"], "ok", (done, events))
        for host in ("app", "postgres", "kernel", "garage"):
            self.assertIn(f"{host} unreachable", text, (text, events))
        self.assertIn("socket False", text)
        self.assertIn("pypi 200", text)
        self.api.call("DELETE", f"/v1/sessions/{sid}")

    # -- the lifecycle -----------------------------------------------------------

    def test_09_a_stop_closes_the_sessions_and_a_start_begins_fresh(self):
        _, session, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        sid = session["id"]
        self.api.execute(sid, "y = 1")
        status, record, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/stop")
        self.assertEqual(status, 200)
        self.assertEqual(record["state"], "stopped")
        status, body, _ = self.api.call("GET", f"/v1/sessions/{sid}")
        self.assertEqual(status, 404)
        status, body, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        self.assertEqual(status, 409)
        self.assertIn("stopped, not running", body["error"])
        status, record, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/start")
        self.assertEqual(record["state"], "running")
        _, session, _ = self.api.call("POST", f"/v1/runtimes/{self.runtime}/sessions")
        events, done = self.api.execute(session["id"], "print('y' in dir())")
        self.assertEqual(events[0]["text"], "False\n")
        events, done = self.api.execute(session["id"], "import pathlib; print(sorted(p.name for p in pathlib.Path('.').iterdir() if p.is_file()))")
        self.assertIn("out.txt", events[0]["text"])

    def test_10_a_remove_refuses_open_sessions_unless_asked_and_takes_the_volume(self):
        status, body, _ = self.api.call("DELETE", f"/v1/runtimes/{self.runtime}")
        self.assertEqual(status, 409)
        self.assertIn("session(s) are open", body["error"])
        status, body, _ = self.api.call("DELETE", f"/v1/runtimes/{self.runtime}?closeSessions=1")
        self.assertEqual(status, 200)
        self.assertEqual(body["sessionsClosed"], 1)
        with self.assertRaises(docker.errors.NotFound):
            self.client.containers.get("calliopa-code-" + self.runtime)
        with self.assertRaises(docker.errors.NotFound):
            self.client.volumes.get("calliopa-code-" + self.runtime)
        status, listing, _ = self.api.call("GET", "/v1/sessions")
        self.assertEqual(listing["sessions"], [])


if __name__ == "__main__":
    unittest.main()
