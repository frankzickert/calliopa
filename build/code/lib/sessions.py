"""Sessions: the Jupyter kernel a runtime's image carries, started in the runtime and spoken to.

A session is one kernel process inside a runtime container, started with a
connection file the service wrote and reached over the protocol's channels on
the runtimes' network. An execution sends a block's code and streams what
comes back — `stdout`, errors, display data, results — already typed by the
protocol, until the kernel says it is idle; a timeout, the output cap or a
person's interrupt ends it early. The files a person's document carries are
placed in the working directory before a send, and what the execution wrote
is read as the files newer than a mark touched at its start.
`docs/system/code-service.md`, The Service. BO_0289_003 BO_0289_004
"""

from __future__ import annotations

import base64
import io
import sys
import json
import mimetypes
import queue
import secrets
import tarfile
import threading
import time
from typing import Any, Callable, Iterator

from docker.errors import DockerException
from jupyter_client import BlockingKernelClient

from .caps import Caps
from .runtimes import Refused, Runtimes, now_iso

SESSION_DIR = "/tmp/calliopa-sessions"
PORT_BASE = 47000
PORT_SPAN = 10
EXECUTIONS_KEPT = 8
IDLE_GRACE_S = 10.0
EXCLUDED_DIRS = ("__pycache__", ".ipynb_checkpoints")

Emit = Callable[[dict[str, Any]], None]


class Session:
    def __init__(self, session_id: str, runtime_id: str, container: Any, spec: dict[str, Any], workdir: str) -> None:
        self.id = session_id
        self.runtime_id = runtime_id
        self.container = container
        self.spec = spec
        self.workdir = workdir
        self.client: BlockingKernelClient | None = None
        self.exec_id = ""
        self.pidfile = f"{SESSION_DIR}/{session_id}.pid"
        self.connection_file = f"{SESSION_DIR}/{session_id}.json"
        self.marker = f"{SESSION_DIR}/{session_id}.mark"
        self.epoch = f"{SESSION_DIR}/{session_id}.epoch"
        self.lock = threading.Lock()
        self.state = "starting"
        self.opened_at = now_iso()
        self.last_used: str | None = None
        self.running: str | None = None
        self.cut: str | None = None
        self.executions: dict[str, dict[str, Any]] = {}
        self.execution_order: list[str] = []

    def record(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "runtime": self.runtime_id,
            "kernelspec": self.spec.get("name", ""),
            "language": self.spec.get("language", ""),
            "state": self.state,
            "openedAt": self.opened_at,
            "lastUsedAt": self.last_used,
            "running": self.running,
            "executions": len(self.execution_order),
            "kernelRunning": self.state == "ready",
        }


class Sessions:
    def __init__(self, runtimes: Runtimes, caps: Caps) -> None:
        self.runtimes = runtimes
        self.caps = caps
        self.by_id: dict[str, Session] = {}
        self.lock = threading.Lock()
        self.ports: dict[str, int] = {}
        runtimes.on_stop = self.close_for_runtime

    # -- registry -----------------------------------------------------------

    def list(self, runtime_id: str | None = None) -> list[dict[str, Any]]:
        with self.lock:
            sessions = [s for s in self.by_id.values() if runtime_id is None or s.runtime_id == runtime_id]
        return [s.record() for s in sorted(sessions, key=lambda s: s.opened_at)]

    def get(self, session_id: str) -> Session:
        with self.lock:
            session = self.by_id.get(session_id)
        if session is None:
            raise Refused(404, f"no session {session_id}")
        return session

    # -- opening ------------------------------------------------------------

    def open(self, runtime_id: str) -> Session:
        record = self.runtimes.get(runtime_id)
        if record["state"] != "running":
            raise Refused(409, f"the runtime is {record['state']}, not running")
        container = self.runtimes.container(runtime_id)
        spec = record.get("kernelspec") or {}
        if not spec.get("argv"):
            raise Refused(409, "the runtime carries no kernelspec to start")
        session = Session("s-" + secrets.token_hex(4), runtime_id, container, spec, self.runtimes.workdir)
        ports = self._allocate_ports(runtime_id)
        ip = self.runtimes.container_ip(container)
        info = {
            "transport": "tcp", "ip": ip, "key": secrets.token_hex(16), "signature_scheme": "hmac-sha256",
            "shell_port": ports[0], "iopub_port": ports[1], "stdin_port": ports[2],
            "control_port": ports[3], "hb_port": ports[4], "kernel_name": spec.get("name", ""),
        }
        user = self.runtimes.container_user(container)
        try:
            self._place(container, session.connection_file, json.dumps(info).encode("utf-8"))
            container.exec_run(["sh", "-c", f'touch "{session.epoch}"'], user="root")
            argv = [
                part.replace("{connection_file}", session.connection_file).replace("{resource_dir}", spec.get("resourceDir", ""))
                for part in spec["argv"]
            ]
            command = ["sh", "-c", 'echo $$ > "$0" && exec "$@"', session.pidfile, *argv]
            api = self.runtimes.client.api
            created = api.exec_create(
                container.id, command, workdir=self.workdir, user=user or None,
                environment=spec.get("env") or None,
            )
            session.exec_id = created["Id"]
            api.exec_start(session.exec_id, detach=True)
            client = BlockingKernelClient()
            client.load_connection_info(info)
            client.start_channels()
            session.client = client
            self._wait_ready(session)
        except Refused:
            self._tear_down(session)
            raise
        except (DockerException, OSError) as failure:
            self._tear_down(session)
            raise Refused(502, f"the kernel could not be started: {failure}") from failure
        session.state = "ready"
        with self.lock:
            self.by_id[session.id] = session
        return session

    @property
    def workdir(self) -> str:
        return self.runtimes.workdir

    def _allocate_ports(self, runtime_id: str) -> list[int]:
        with self.lock:
            index = self.ports.get(runtime_id, 0)
            self.ports[runtime_id] = index + 1
        base = PORT_BASE + PORT_SPAN * index
        return [base + offset for offset in range(5)]

    def _place(self, container: Any, path: str, content: bytes) -> None:
        """One file into the container, readable by whoever the kernel runs as."""
        directory, name = path.rsplit("/", 1)
        container.exec_run(["sh", "-c", f'mkdir -p "{directory}" && chmod 1777 "{directory}"'], user="root")
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as archive:
            info = tarfile.TarInfo(name)
            info.size = len(content)
            info.mode = 0o644
            info.mtime = int(time.time())
            archive.addfile(info, io.BytesIO(content))
        container.put_archive(directory, buffer.getvalue())

    def _wait_ready(self, session: Session) -> None:
        deadline = time.monotonic() + self.caps.session_ready_s
        api = self.runtimes.client.api
        while True:
            state = api.exec_inspect(session.exec_id)
            if not state.get("Running", False) and state.get("ExitCode") is not None:
                raise Refused(502, f"the kernel ended before it answered, with exit code {state.get('ExitCode')}")
            try:
                session.client.wait_for_ready(timeout=3)
                return
            except RuntimeError:
                if time.monotonic() > deadline:
                    raise Refused(502, f"the kernel did not answer within {self.caps.session_ready_s:g} seconds") from None

    def _alive(self, session: Session) -> bool:
        """Whether the kernel process still runs; a session whose kernel ended is dead."""
        if session.state != "ready":
            return False
        try:
            state = self.runtimes.client.api.exec_inspect(session.exec_id)
        except DockerException:
            return False
        if state.get("Running", False):
            return True
        session.state = "dead"
        print(f"code: the kernel of session {session.id} ended with exit code {state.get('ExitCode')}", file=sys.stderr)
        return False

    def _tear_down(self, session: Session) -> None:
        if session.client is not None:
            try:
                session.client.stop_channels()
            except Exception:  # noqa: BLE001 - a channel that is already gone
                pass
        self._signal(session, "TERM")
        try:
            session.container.exec_run(
                ["sh", "-c", f'rm -f "{session.pidfile}" "{session.connection_file}" "{session.marker}" "{session.epoch}"'],
                user="root"
            )
        except DockerException:
            pass

    def _signal(self, session: Session, signal_name: str) -> None:
        try:
            session.container.exec_run(
                ["sh", "-c", f'[ -f "{session.pidfile}" ] && kill -{signal_name} "$(cat "{session.pidfile}")" 2>/dev/null; true'],
                user="root",
            )
        except DockerException:
            pass

    # -- closing ------------------------------------------------------------

    def close(self, session_id: str) -> None:
        with self.lock:
            session = self.by_id.pop(session_id, None)
        if session is None:
            raise Refused(404, f"no session {session_id}")
        session.state = "closed"
        self._tear_down(session)

    def close_for_runtime(self, runtime_id: str) -> int:
        with self.lock:
            gone = [s for s in self.by_id.values() if s.runtime_id == runtime_id]
            for session in gone:
                del self.by_id[session.id]
        for session in gone:
            session.state = "closed"
            try:
                self._tear_down(session)
            except Refused:
                pass
        return len(gone)

    # -- interrupting -------------------------------------------------------

    def interrupt(self, session_id: str) -> bool:
        session = self.get(session_id)
        if session.running is None or not self._alive(session):
            return False
        session.cut = session.cut or "interrupted"
        self._interrupt_kernel(session)
        return True

    def _interrupt_kernel(self, session: Session) -> None:
        if session.spec.get("interruptMode") == "message" and session.client is not None:
            session.client.control_channel.send(session.client.session.msg("interrupt_request", {}))
        else:
            self._signal(session, "INT")

    # -- executing ----------------------------------------------------------

    def execute(self, session_id: str, code: str, collect: bool, emit: Emit) -> dict[str, Any]:
        session = self.get(session_id)
        if not self._alive(session):
            raise Refused(409, f"the session is {session.state}: its kernel has ended; open a new session")
        with session.lock:
            execution_id = "x-" + secrets.token_hex(4)
            session.running = execution_id
            session.cut = None
            started = time.monotonic()
            self.runtimes.touch(session.runtime_id)
            try:
                self._mark(session)
                message_id = session.client.execute(code, allow_stdin=False, stop_on_error=True)
                count, reply_status = self._drain(session, message_id, emit, started)
                files, truncated = self._written(session) if collect else ([], False)
            finally:
                session.running = None
                session.last_used = now_iso()
            status = session.cut or reply_status
            done = {
                "event": "done", "execution": execution_id, "status": status,
                "elapsed": round(time.monotonic() - started, 3), "executionCount": count,
                "files": files, "filesTruncated": truncated,
            }
            session.executions[execution_id] = {"files": files, "status": status, "at": session.last_used}
            session.execution_order.append(execution_id)
            while len(session.execution_order) > EXECUTIONS_KEPT:
                session.executions.pop(session.execution_order.pop(0), None)
            return done

    def _mark(self, session: Session) -> None:
        session.container.exec_run(["sh", "-c", f'mkdir -p "{SESSION_DIR}" && touch "{session.marker}"'], user="root")

    def _drain(self, session: Session, message_id: str, emit: Emit, started: float) -> tuple[int | None, str]:
        """Every iopub message of this execution until idle, then the reply; cuts on the caps."""
        client = session.client
        deadline = started + self.caps.execution_timeout_s
        grace: float | None = None
        produced = 0
        count: int | None = None
        idle = False
        checked = time.monotonic()
        while not idle:
            now = time.monotonic()
            # A kernel that ends mid-execution — killed, crashed, exited by
            # the code — answers nothing more: the execution ends now and says
            # so, rather than waiting out the time cap. Found in the walk.
            if now - checked >= 1.0:
                checked = now
                if not self._alive(session):
                    session.cut = "the kernel ended"
                    break
            if grace is None:
                if session.cut is not None:
                    grace = now + IDLE_GRACE_S
                elif now > deadline:
                    session.cut = "timed out"
                    self._interrupt_kernel(session)
                    grace = now + IDLE_GRACE_S
            elif now > grace:
                self._signal(session, "KILL")
                session.state = "dead"
                break
            try:
                message = client.get_iopub_msg(timeout=0.5)
            except queue.Empty:
                continue
            if message.get("parent_header", {}).get("msg_id") != message_id:
                continue
            kind = message["msg_type"]
            content = message["content"]
            if kind == "status":
                idle = content.get("execution_state") == "idle"
                continue
            event = self._event(kind, content)
            if event is None:
                continue
            if kind in ("execute_result", "display_data", "update_display_data") and content.get("execution_count") is not None:
                count = content["execution_count"]
            produced += len(json.dumps(event))
            if produced > self.caps.output_max_bytes and session.cut is None:
                session.cut = "output cap"
                self._interrupt_kernel(session)
                emit({"event": "cut", "reason": session.cut, "bytes": produced})
                continue
            if session.cut != "output cap":
                emit(event)
        reply_status = "ok"
        if session.cut == "the kernel ended":
            return count, "error"
        reply_deadline = time.monotonic() + (IDLE_GRACE_S if session.state == "ready" else 1.0)
        while time.monotonic() < reply_deadline:
            try:
                reply = client.get_shell_msg(timeout=0.5)
            except queue.Empty:
                continue
            if reply.get("parent_header", {}).get("msg_id") != message_id:
                continue
            content = reply["content"]
            reply_status = {"ok": "ok", "error": "error", "abort": "error", "aborted": "error"}.get(content.get("status"), "ok")
            if content.get("execution_count") is not None:
                count = content["execution_count"]
            break
        if session.state == "dead" and session.cut is None:
            session.cut = "the kernel stopped answering"
        return count, reply_status

    @staticmethod
    def _event(kind: str, content: dict[str, Any]) -> dict[str, Any] | None:
        if kind == "stream":
            return {"event": "stream", "name": content.get("name", "stdout"), "text": content.get("text", "")}
        if kind in ("display_data", "update_display_data"):
            return {"event": "display", "data": _bundle(content.get("data", {})), "metadata": content.get("metadata", {})}
        if kind == "execute_result":
            return {
                "event": "result", "data": _bundle(content.get("data", {})),
                "metadata": content.get("metadata", {}), "executionCount": content.get("execution_count"),
            }
        if kind == "error":
            return {
                "event": "error", "name": content.get("ename", ""), "value": content.get("evalue", ""),
                "traceback": list(content.get("traceback", [])),
            }
        if kind == "clear_output":
            return {"event": "clear", "wait": bool(content.get("wait", False))}
        return None

    # -- files --------------------------------------------------------------

    def put_files(self, session_id: str, archive: bytes) -> dict[str, Any]:
        session = self.get(session_id)
        if len(archive) > self.caps.copy_max_bytes:
            raise Refused(413, f"the copy is above the cap of {self.caps.copy_max_bytes} bytes")
        try:
            with tarfile.open(fileobj=io.BytesIO(archive), mode="r:*") as tar:
                members = tar.getmembers()
        except tarfile.TarError as broken:
            raise Refused(400, f"not a tar: {broken}") from broken
        names = []
        for member in members:
            if member.name.startswith("/") or ".." in member.name.split("/"):
                raise Refused(400, f"a member escapes the working directory: {member.name}")
            if member.isfile():
                names.append(member.name)
        with session.lock:
            session.container.put_archive(session.workdir, archive)
            if names:
                # What was copied in is dated before the session began, so no mark touched at a
                # send can find it newer: only what the code writes afterwards is written.
                quoted = " ".join(f'"{name}"' for name in names)
                steps = [f'cd "{session.workdir}"', f'touch -r "{session.epoch}" -- {quoted}']
                user = self.runtimes.container_user(session.container)
                if user and user not in ("root", "0"):
                    tops = " ".join(f'"{top}"' for top in sorted({name.split("/", 1)[0] for name in names}))
                    steps.append(f'chown -R "{user}" {tops}')
                session.container.exec_run(["sh", "-c", " && ".join(steps)], user="root")
        return {"files": len(names), "bytes": len(archive)}

    def _written(self, session: Session) -> tuple[list[dict[str, Any]], bool]:
        excluded = " ".join(f'! -path "*/{name}/*"' for name in EXCLUDED_DIRS)
        script = (
            f'cd "{session.workdir}" && find . -type f -newer "{session.marker}" {excluded} '
            '-exec stat -c "%s %n" {} + 2>/dev/null'
        )
        result = session.container.exec_run(["sh", "-c", script], user="root")
        files: list[dict[str, Any]] = []
        total = 0
        truncated = False
        for line in result.output.decode("utf-8", "replace").splitlines():
            if " " not in line:
                continue
            size, name = line.split(" ", 1)
            name = name[2:] if name.startswith("./") else name
            try:
                length = int(size)
            except ValueError:
                continue
            if total + length > self.caps.copy_max_bytes:
                truncated = True
                break
            total += length
            files.append({"name": name, "size": length, "mediaType": mimetypes.guess_type(name)[0] or "application/octet-stream"})
        files.sort(key=lambda entry: entry["name"])
        return files, truncated

    def written_files(self, session_id: str, execution_id: str) -> list[dict[str, Any]]:
        session = self.get(session_id)
        execution = session.executions.get(execution_id)
        if execution is None:
            raise Refused(404, f"no execution {execution_id} in this session's memory")
        return execution["files"]

    def files_archive(self, session_id: str, execution_id: str) -> tuple[list[dict[str, Any]], Iterator[bytes]]:
        session = self.get(session_id)
        files = self.written_files(session_id, execution_id)
        if not files:
            return files, iter(())
        names = [entry["name"] for entry in files]
        _, stream = session.container.exec_run(
            ["tar", "-cf", "-", "-C", session.workdir, *names], stream=True, demux=True, user="root"
        )

        def chunks() -> Iterator[bytes]:
            for out, _err in stream:
                if out:
                    yield out

        return files, chunks()


def _bundle(data: dict[str, Any]) -> dict[str, Any]:
    """A MIME bundle as JSON: text as it is, binary already base64 by the protocol, bytes made so."""
    bundle: dict[str, Any] = {}
    for mime, value in data.items():
        if isinstance(value, bytes):
            value = base64.b64encode(value).decode("ascii")
        elif isinstance(value, list):
            value = "".join(str(part) for part in value)
        bundle[mime] = value
    return bundle
