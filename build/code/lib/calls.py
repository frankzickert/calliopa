"""Calls: one profile tool's code, run once in a throwaway container and answered.

A call never touches a person's runtime or session. It starts a container from
the runtime's image with the runtime's kernelspec, on no network at all or on
the runtimes' network as the kernel asks, with the environment it was given and
the input written to `/calliopa/input.json`. The kernel inside is reached by a
driver from the service's own image started in the call's network namespace,
so a call off every network is reached over its loopback alone. Both
containers are removed when the call is answered, whatever happened.
`docs/system/code-service.md`, Profile Tools. BO_0311_001
"""

from __future__ import annotations

import io
import json
import re
import secrets
import tarfile
import threading
import time
from typing import Any

import docker
from docker.errors import DockerException

from .caps import Caps
from .runtimes import KEEP_ALIVE, LABEL, SCOPE_LABEL, Refused, Runtimes

NETWORKS = ("none", "runtimes")
DRIVER = "/opt/calliopa/code/lib/calldriver.py"
CALL_DIR = "/tmp/calliopa-call"
PORT_BASE = 47000
# The driver's own wait beyond the kernel's caps: to start, to print, to end.
GRACE_S = 20.0
_ENV_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class Calls:
    def __init__(self, runtimes: Runtimes, caps: Caps) -> None:
        self.runtimes = runtimes
        self.caps = caps
        self.lock = threading.Lock()

    @property
    def client(self) -> docker.DockerClient:
        return self.runtimes.client

    def containers(self) -> list[Any]:
        return [
            c for c in self.client.containers.list(all=True, filters={"label": f"{LABEL}=call"})
            if c.labels.get(SCOPE_LABEL) == self.runtimes.scope
        ]

    def reap(self) -> int:
        """A call's containers left by a service that ended mid-call."""
        gone = 0
        for kind in ("call", "call-driver"):
            for container in self.client.containers.list(all=True, filters={"label": f"{LABEL}={kind}"}):
                if container.labels.get(SCOPE_LABEL) != self.runtimes.scope:
                    continue
                try:
                    container.remove(force=True)
                    gone += 1
                except DockerException:
                    pass
        return gone

    def run(self, runtime_id: str, code: Any, value: Any, network: Any, env: Any) -> dict[str, Any]:
        if not isinstance(code, str) or not code.strip():
            raise Refused(400, "`code` is the block's code as text")
        if network not in NETWORKS:
            raise Refused(400, "`network` is `none` or `runtimes`")
        env = env if env is not None else {}
        if not isinstance(env, dict) or not all(isinstance(k, str) and _ENV_NAME.match(k) and isinstance(v, str) for k, v in env.items()):
            raise Refused(400, "`env` maps variable names to text")
        try:
            record = self.runtimes.get(runtime_id)
        except Refused as missing:
            if missing.status == 404:
                raise Refused(409, f"no runtime {runtime_id} in this service's scope") from missing
            raise
        if record["state"] != "running":
            raise Refused(409, f"the runtime is {record['state']}, not running")
        spec = record.get("kernelspec") or {}
        if not spec.get("argv"):
            raise Refused(409, "the runtime carries no kernelspec to start")
        own = self.runtimes.own_container()
        if own is None:
            raise Refused(503, "the service runs outside a container, so it cannot start a call's driver")
        with self.lock:
            if len(self.runtimes.list()) + len(self.containers()) >= self.caps.max_runtimes:
                raise Refused(503, f"the running cap of {self.caps.max_runtimes} is reached; try again when a call ends")
            call_id = "c-" + secrets.token_hex(4)
            container = self._start_call(call_id, runtime_id, record["image"], network, env)
        driver = None
        started = time.monotonic()
        try:
            self._prepare(container, value)
            info = self._start_kernel(container, spec)
            driver = self._start_driver(call_id, container, own.image.id, info, code)
            outputs, end = self._collect(driver)
        finally:
            for thing in (driver, container):
                if thing is not None:
                    try:
                        thing.remove(force=True)
                    except DockerException:
                        pass
        self.runtimes.touch(runtime_id)
        return {
            "call": call_id, "status": end.get("status", "the call ended without an answer"),
            "elapsed": round(time.monotonic() - started, 3), "executionCount": end.get("executionCount"),
            "network": network, "outputs": outputs,
        }

    def _start_call(self, call_id: str, runtime_id: str, image: str, network: str, env: dict[str, str]) -> Any:
        labels = {LABEL: "call", SCOPE_LABEL: self.runtimes.scope, f"{LABEL}.call": call_id, f"{LABEL}.runtime": runtime_id}
        options: dict[str, Any] = {"network_mode": "none"} if network == "none" else {"network": self.runtimes.network.name}
        container = self.client.containers.create(
            image, command=KEEP_ALIVE, name=f"calliopa-code-{call_id}", labels=labels,
            environment={**env, "CALLIOPA_INPUT": f"{self.runtimes.workdir}/input.json"},
            working_dir=self.runtimes.workdir, mem_limit=self.caps.memory_bytes,
            nano_cpus=int(self.caps.cpus * 1e9), healthcheck={"test": ["NONE"]}, detach=True, **options,
        )
        try:
            container.start()
        except DockerException:
            container.remove(force=True)
            raise
        return container

    def _prepare(self, container: Any, value: Any) -> None:
        workdir = self.runtimes.workdir
        container.exec_run(["sh", "-c", f'mkdir -p "{workdir}" "{CALL_DIR}" && chmod 1777 "{workdir}" "{CALL_DIR}"'], user="root")
        self._place(container, workdir, "input.json", json.dumps(value).encode("utf-8"))

    @staticmethod
    def _place(container: Any, directory: str, name: str, content: bytes) -> None:
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as archive:
            info = tarfile.TarInfo(name)
            info.size = len(content)
            info.mode = 0o644
            info.mtime = int(time.time())
            archive.addfile(info, io.BytesIO(content))
        container.put_archive(directory, buffer.getvalue())

    def _start_kernel(self, container: Any, spec: dict[str, Any]) -> dict[str, Any]:
        info = {
            "transport": "tcp", "ip": "127.0.0.1", "key": secrets.token_hex(16), "signature_scheme": "hmac-sha256",
            "shell_port": PORT_BASE, "iopub_port": PORT_BASE + 1, "stdin_port": PORT_BASE + 2,
            "control_port": PORT_BASE + 3, "hb_port": PORT_BASE + 4, "kernel_name": spec.get("name", ""),
        }
        connection = f"{CALL_DIR}/kernel.json"
        self._place(container, CALL_DIR, "kernel.json", json.dumps(info).encode("utf-8"))
        argv = [
            part.replace("{connection_file}", connection).replace("{resource_dir}", spec.get("resourceDir", ""))
            for part in spec["argv"]
        ]
        container.reload()
        api = self.client.api
        created = api.exec_create(
            container.id, argv, workdir=self.runtimes.workdir,
            user=self.runtimes.container_user(container) or None, environment=spec.get("env") or None,
        )
        api.exec_start(created["Id"], detach=True)
        return info

    def _start_driver(self, call_id: str, container: Any, image: str, info: dict[str, Any], code: str) -> Any:
        driver = self.client.containers.create(
            image, entrypoint=["python3", DRIVER], name=f"calliopa-code-{call_id}-driver",
            labels={LABEL: "call-driver", SCOPE_LABEL: self.runtimes.scope, f"{LABEL}.call": call_id},
            network_mode=f"container:{container.id}", mem_limit=256 * 1024**2, detach=True,
            environment={
                "CALLIOPA_CALL_CONNECTION": json.dumps(info), "CALLIOPA_CALL_CODE": code,
                "CALLIOPA_CALL_TIMEOUT_S": f"{self.caps.execution_timeout_s:g}",
                "CALLIOPA_CALL_READY_S": f"{self.caps.session_ready_s:g}",
                "CALLIOPA_CALL_OUTPUT_MAX": str(self.caps.output_max_bytes),
            },
        )
        driver.start()
        return driver

    def _collect(self, driver: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        limit = self.caps.session_ready_s + self.caps.execution_timeout_s + GRACE_S
        try:
            driver.wait(timeout=limit)
        except Exception:  # noqa: BLE001 - the daemon's read timeout, whichever library raised it
            return self._read(driver)[0], {"status": "timed out"}
        return self._read(driver)

    @staticmethod
    def _read(driver: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        outputs: list[dict[str, Any]] = []
        end: dict[str, Any] = {}
        for line in driver.logs(stdout=True, stderr=False).decode("utf-8", "replace").splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(event, dict):
                continue
            if event.get("event") == "end":
                end = event
            else:
                outputs.append(event)
        return outputs, end
