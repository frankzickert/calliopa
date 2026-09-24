"""Runtimes: containers the owner created from an image that carries a Jupyter kernelspec.

The service is the only holder of the docker socket, and this module is the
only place it is used. A runtime is a container on the runtimes' network alone
— a bridge of the service's own with a route out and none to the stack — with
a volume of its own as its working directory, bounded by the caps, kept until
the owner removes it. The image's kernelspecs are read once, before the
container exists, and the chosen one is written into the container's labels,
so the service keeps no state of its own: the daemon is the record.
`docs/system/code-service.md`, The Service. BO_0289_002
"""

from __future__ import annotations

import json
import secrets
import socket
import threading
import time
from datetime import datetime, timezone
from typing import Any

import docker
from docker.errors import APIError, DockerException, ImageNotFound, NotFound

from .caps import Caps

LABEL = "calliopa.code"
# The service instance a runtime belongs to: the stack's service and a test's
# service share one daemon, and each sees, counts and reaps its own runtimes
# alone. A runtime made before the label reads as the stack's. Found in the
# walk, when a test run reaped the instance's kernels.
SCOPE_LABEL = "calliopa.code.scope"
DEFAULT_SCOPE = "stack"
NETWORK_LABEL = "calliopa.code.network"
NETWORK_NAME = "calliopa-code-runtimes"
KEEP_ALIVE = ["sh", "-c", "while :; do sleep 3600; done"]

# Where kernelspecs live when `jupyter` itself is not on the image's path:
# the system, the interpreter's prefix and the user's home.
_SCAN = r"""
if command -v jupyter >/dev/null 2>&1; then
  jupyter kernelspec list --json 2>/dev/null && exit 0
fi
prefix=$(python3 -c 'import sys; print(sys.prefix)' 2>/dev/null || true)
for d in /usr/local/share/jupyter/kernels /usr/share/jupyter/kernels \
         /opt/conda/share/jupyter/kernels "$prefix/share/jupyter/kernels" \
         "$HOME/.local/share/jupyter/kernels" "$HOME/.jupyter/kernels" \
         /root/.local/share/jupyter/kernels; do
  for k in "$d"/*/kernel.json; do
    [ -f "$k" ] && printf '==%s\n' "$k" && cat "$k" && printf '\n'
  done
done
exit 0
"""


class Refused(Exception):
    """An answer in words with its status: the caller asked for something the service refuses."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_kernelspecs(output: str) -> list[dict[str, Any]]:
    """The scan's output as spec records, whichever way it was produced."""
    text = output.strip()
    specs: list[dict[str, Any]] = []
    if text.startswith("{"):
        try:
            listed = json.loads(text).get("kernelspecs", {})
        except json.JSONDecodeError:
            listed = {}
        for name, entry in listed.items():
            spec = entry.get("spec", {})
            specs.append(_spec_record(name, entry.get("resource_dir", ""), spec))
        return specs
    for block in text.split("\n=="):
        block = block.lstrip("=")
        if "\n" not in block:
            continue
        path, body = block.split("\n", 1)
        path = path.strip()
        try:
            spec = json.loads(body)
        except json.JSONDecodeError:
            continue
        resource_dir = path.rsplit("/", 1)[0]
        specs.append(_spec_record(resource_dir.rsplit("/", 1)[-1], resource_dir, spec))
    return specs


def _spec_record(name: str, resource_dir: str, spec: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": name,
        "displayName": spec.get("display_name", name),
        "language": spec.get("language", ""),
        "argv": list(spec.get("argv", [])),
        "interruptMode": spec.get("interrupt_mode", "signal"),
        "env": dict(spec.get("env", {})),
        "resourceDir": resource_dir,
    }


def choose_kernelspec(specs: list[dict[str, Any]], wanted: str | None) -> dict[str, Any]:
    """The one asked for, else `python3`, else the first by name; none is a refusal."""
    if not specs:
        raise Refused(400, "the image carries no Jupyter kernelspec")
    by_name = {spec["name"]: spec for spec in specs if spec.get("argv")}
    if wanted:
        if wanted not in by_name:
            raise Refused(400, f"the image carries no kernelspec named {wanted}; it carries {', '.join(sorted(by_name))}")
        return by_name[wanted]
    if "python3" in by_name:
        return by_name["python3"]
    if not by_name:
        raise Refused(400, "the image carries no Jupyter kernelspec")
    return by_name[sorted(by_name)[0]]


def normalize_image(image: str) -> str:
    """A reference with neither tag nor digest names `latest`: a bare name would pull every tag."""
    image = image.strip()
    if not image or any(c.isspace() for c in image):
        raise Refused(400, "an image reference is one word")
    last = image.rsplit("/", 1)[-1]
    if "@" not in last and ":" not in last:
        return image + ":latest"
    return image


class Runtimes:
    """Every runtime the daemon holds, plus the ones still being made."""

    def __init__(self, client: docker.DockerClient, caps: Caps, workdir: str = "/calliopa", scope: str = DEFAULT_SCOPE) -> None:
        self.client = client
        self.caps = caps
        self.workdir = workdir
        self.scope = scope
        self.pending: dict[str, dict[str, Any]] = {}
        self.last_used: dict[str, str] = {}
        self.lock = threading.Lock()
        self.network: Any = None
        self.on_stop = None  # set by the sessions registry: called with a runtime id before it stops or goes

    # -- the network --------------------------------------------------------

    def ensure_network(self) -> Any:
        found = self.client.networks.list(filters={"label": f"{NETWORK_LABEL}=runtimes"})
        self.network = found[0] if found else self.client.networks.create(
            NETWORK_NAME, driver="bridge", labels={NETWORK_LABEL: "runtimes"}
        )
        return self.network

    def own_container(self) -> Any:
        try:
            return self.client.containers.get(socket.gethostname())
        except (NotFound, APIError):
            return None

    def join_network(self) -> bool:
        """The service reaches a session's ports only from the runtimes' network; join it if not there."""
        own = self.own_container()
        if own is None:
            return False
        own.reload()
        if self.network.name in own.attrs["NetworkSettings"]["Networks"]:
            return True
        self.network.connect(own)
        return True

    # -- records ------------------------------------------------------------

    def _mine(self, container: Any) -> bool:
        return container.labels.get(SCOPE_LABEL, DEFAULT_SCOPE) == self.scope

    def containers(self) -> list[Any]:
        return [c for c in self.client.containers.list(all=True, filters={"label": f"{LABEL}=runtime"}) if self._mine(c)]

    def container(self, runtime_id: str) -> Any:
        found = [c for c in self.client.containers.list(all=True, filters={"label": f"{LABEL}.id={runtime_id}"}) if self._mine(c)]
        return found[0] if found else None

    def record(self, container: Any) -> dict[str, Any]:
        container.reload()
        labels = container.labels
        runtime_id = labels.get(f"{LABEL}.id", "")
        status = container.status
        state = {"running": "running", "restarting": "starting", "removing": "removing"}.get(status, "stopped")
        started = container.attrs.get("State", {}).get("StartedAt") if state == "running" else None
        try:
            spec = json.loads(labels.get(f"{LABEL}.kernelspec", "null"))
        except json.JSONDecodeError:
            spec = None
        return {
            "id": runtime_id,
            "name": labels.get(f"{LABEL}.name", ""),
            "image": labels.get(f"{LABEL}.image", ""),
            "kernelspec": spec,
            "state": state,
            "error": None,
            "createdAt": labels.get(f"{LABEL}.created", ""),
            "startedAt": started,
            "lastUsedAt": self.last_used.get(runtime_id) or started,
            "container": container.id[:12],
        }

    def list(self) -> list[dict[str, Any]]:
        with self.lock:
            pending = [dict(record) for record in self.pending.values()]
        records = [self.record(container) for container in self.containers()] + pending
        return sorted(records, key=lambda record: record["createdAt"])

    def get(self, runtime_id: str) -> dict[str, Any]:
        with self.lock:
            pending = self.pending.get(runtime_id)
            if pending is not None:
                return dict(pending)
        container = self.container(runtime_id)
        if container is None:
            raise Refused(404, f"no runtime {runtime_id}")
        return self.record(container)

    def touch(self, runtime_id: str) -> None:
        self.last_used[runtime_id] = now_iso()

    def container_ip(self, container: Any) -> str:
        container.reload()
        networks = container.attrs["NetworkSettings"]["Networks"]
        entry = networks.get(self.network.name) or next(iter(networks.values()), {})
        ip = entry.get("IPAddress", "")
        if not ip:
            raise Refused(502, "the runtime has no address on the runtimes' network")
        return ip

    @staticmethod
    def container_user(container: Any) -> str:
        return (container.attrs.get("Config", {}) or {}).get("User", "") or ""

    # -- creating -----------------------------------------------------------

    def create(self, name: str, image: str, kernelspec: str | None = None) -> dict[str, Any]:
        name = (name or "").strip()
        if not name or len(name) > 64:
            raise Refused(400, "a runtime needs a name of at most 64 characters")
        image = normalize_image(image or "")
        if len(self.list()) >= self.caps.max_runtimes:
            raise Refused(503, f"the runtime cap of {self.caps.max_runtimes} is reached; remove one first")
        runtime_id = secrets.token_hex(4)
        record = {
            "id": runtime_id, "name": name, "image": image, "kernelspec": None,
            "state": "pulling", "error": None, "createdAt": now_iso(),
            "startedAt": None, "lastUsedAt": None, "container": None,
        }
        with self.lock:
            self.pending[runtime_id] = record
        threading.Thread(target=self._materialize, args=(runtime_id, name, image, kernelspec), daemon=True).start()
        return dict(record)

    def _set_pending(self, runtime_id: str, **fields: Any) -> None:
        with self.lock:
            record = self.pending.get(runtime_id)
            if record is not None:
                record.update(fields)

    def _materialize(self, runtime_id: str, name: str, image: str, wanted: str | None) -> None:
        container = None
        volume = None
        try:
            self._pull(image)
            self._set_pending(runtime_id, state="inspecting")
            spec = choose_kernelspec(self.discover_kernelspecs(image), wanted)
            self._set_pending(runtime_id, state="creating")
            volume = self.client.volumes.create(
                f"calliopa-code-{runtime_id}", labels={LABEL: "volume", f"{LABEL}.id": runtime_id}
            )
            labels = {
                LABEL: "runtime",
                SCOPE_LABEL: self.scope,
                f"{LABEL}.id": runtime_id,
                f"{LABEL}.name": name,
                f"{LABEL}.image": image,
                f"{LABEL}.kernelspec": json.dumps(spec),
                f"{LABEL}.created": now_iso(),
            }
            container = self.client.containers.create(
                image,
                command=KEEP_ALIVE,
                name=f"calliopa-code-{runtime_id}",
                labels=labels,
                network=self.network.name,
                volumes={volume.name: {"bind": self.workdir, "mode": "rw"}},
                working_dir=self.workdir,
                mem_limit=self.caps.memory_bytes,
                nano_cpus=int(self.caps.cpus * 1e9),
                # The image's own health check, when it has one, looks for a
                # server the runtime never starts (a Jupyter image's notebook
                # on 8888), and the runtime would read unhealthy for good.
                healthcheck={"test": ["NONE"]},
                detach=True,
            )
            container.start()
            self._prepare_volume(container)
        except Refused as refused:
            self._set_pending(runtime_id, state="failed", error=refused.message)
            self._discard(container, volume)
        except (DockerException, OSError) as failure:
            self._set_pending(runtime_id, state="failed", error=f"the daemon refused: {failure}")
            self._discard(container, volume)
        else:
            with self.lock:
                self.pending.pop(runtime_id, None)

    def _discard(self, container: Any, volume: Any) -> None:
        for thing in (container, volume):
            if thing is None:
                continue
            try:
                thing.remove(force=True)
            except DockerException:
                pass

    def _pull(self, image: str) -> None:
        try:
            self.client.images.get(image)
            return
        except ImageNotFound:
            pass
        try:
            self.client.images.pull(image)
        except ImageNotFound as missing:
            raise Refused(400, f"no image {image}: {missing.explanation or missing}") from missing
        except APIError as failure:
            raise Refused(502, f"the image {image} could not be pulled: {failure.explanation or failure}") from failure

    def discover_kernelspecs(self, image: str) -> list[dict[str, Any]]:
        """A throwaway run of the image, off every network, printing its kernelspecs."""
        try:
            output = self.client.containers.run(
                image, command=["sh", "-c", _SCAN], remove=True, network_mode="none",
                mem_limit=self.caps.memory_bytes, stderr=False, stdout=True,
            )
        except APIError as failure:
            raise Refused(502, f"the image could not be inspected: {failure.explanation or failure}") from failure
        return parse_kernelspecs(output.decode("utf-8", "replace") if isinstance(output, bytes) else str(output))

    def _prepare_volume(self, container: Any) -> None:
        """A fresh volume is root's; the kernel runs as the image's user and has to write there."""
        container.reload()
        user = self.container_user(container)
        if user and user not in ("root", "0"):
            container.exec_run(["sh", "-c", f'chown -R "{user}" "{self.workdir}"'], user="root")

    # -- the lifecycle ------------------------------------------------------

    def start(self, runtime_id: str) -> dict[str, Any]:
        container = self._existing(runtime_id)
        if container.status != "running":
            container.start()
            self._prepare_volume(container)
        return self.record(container)

    def stop(self, runtime_id: str) -> dict[str, Any]:
        container = self._existing(runtime_id)
        if self.on_stop is not None:
            self.on_stop(runtime_id)
        if container.status == "running":
            container.stop(timeout=10)
        return self.record(container)

    def remove(self, runtime_id: str) -> None:
        with self.lock:
            pending = self.pending.get(runtime_id)
            if pending is not None:
                if pending["state"] != "failed":
                    raise Refused(409, "the runtime is still being made; wait for it to run or fail")
                del self.pending[runtime_id]
                return
        container = self.container(runtime_id)
        if container is None:
            raise Refused(404, f"no runtime {runtime_id}")
        if self.on_stop is not None:
            self.on_stop(runtime_id)
        container.remove(force=True)
        try:
            self.client.volumes.get(f"calliopa-code-{runtime_id}").remove(force=True)
        except NotFound:
            pass
        self.last_used.pop(runtime_id, None)

    def _existing(self, runtime_id: str) -> Any:
        with self.lock:
            if runtime_id in self.pending:
                raise Refused(409, "the runtime is not made yet")
        container = self.container(runtime_id)
        if container is None:
            raise Refused(404, f"no runtime {runtime_id}")
        return container

    def reap_stale_kernels(self, session_dir: str) -> int:
        """Kernels a previous service started and lost: killed, so their ports are free again."""
        reaped = 0
        script = (
            f'for f in {session_dir}/*.pid; do [ -f "$f" ] || continue; '
            'kill -TERM "$(cat "$f")" 2>/dev/null; rm -f "$f"; echo reaped; done'
        )
        for container in self.containers():
            if container.status != "running":
                continue
            try:
                result = container.exec_run(["sh", "-c", script], user="root")
                reaped += result.output.count(b"reaped")
            except DockerException:
                continue
        return reaped

    def wait_until(self, runtime_id: str, state: str, timeout: float) -> dict[str, Any]:
        """For tests and the walk: the record once it reaches the state, or the last one seen."""
        deadline = time.monotonic() + timeout
        record = self.get(runtime_id)
        while record["state"] not in (state, "failed") and time.monotonic() < deadline:
            time.sleep(0.5)
            record = self.get(runtime_id)
        return record
