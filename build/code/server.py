#!/usr/bin/env python3
"""The code service's front: the bearer, the routes and the stream.

`GET /health` is open and honest about the daemon behind it; everything else
needs the bearer the bootstrap one-shot wrote, and the kernel is the only
caller that holds it. Runtimes are made, listed, started, stopped and removed;
sessions are opened in them, closed and interrupted; an execution streams its
output as server-sent events until it is done; the files a document carries go
in as a tar and the files an execution wrote come out as one. Standard library
for the server, the Docker SDK and jupyter_client behind it.
`docs/system/code-service.md`. BO_0289_001 BO_0289_002 BO_0289_003 BO_0289_004
"""

from __future__ import annotations

import hmac
import json
import os
import re
import signal
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable

import docker
from docker.errors import DockerException

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.caps import Caps  # noqa: E402
from lib.format import Formatting, format_source  # noqa: E402
from lib.runtimes import Refused, Runtimes  # noqa: E402
from lib.sessions import SESSION_DIR, Sessions  # noqa: E402

MAX_JSON_BYTES = 1024 * 1024


def read_bearer(path: str) -> str:
    try:
        with open(path, encoding="utf-8") as handle:
            bearer = handle.read().strip()
    except OSError:
        bearer = ""
    if not bearer:
        raise SystemExit(f"code: no bearer at {path}; the stack's bootstrap writes it")
    return bearer


def read_optional_bearer(path: str) -> str:
    """The formatter's bearer, which a tree without a formatter does not have."""
    if not path:
        return ""
    try:
        with open(path, encoding="utf-8") as handle:
            return handle.read().strip()
    except OSError:
        return ""


class Service:
    """The runtimes, the sessions and the server over them."""

    def __init__(self, client: docker.DockerClient, caps: Caps, bearer: str, port: int, workdir: str = "/calliopa", scope: str = "stack", formatting: Formatting | None = None) -> None:
        self.client = client
        self.caps = caps
        self.formatting = formatting or Formatting()
        self.runtimes = Runtimes(client, caps, workdir, scope)
        self.sessions = Sessions(self.runtimes, caps)
        self.server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(bearer, self))
        self.server.daemon_threads = True

    @property
    def port(self) -> int:
        return self.server.server_address[1]

    def prepare(self) -> None:
        self.runtimes.ensure_network()
        joined = self.runtimes.join_network()
        reaped = self.runtimes.reap_stale_kernels(SESSION_DIR)
        print(
            f"code: runtimes' network {self.runtimes.network.name}, "
            f"{'joined' if joined else 'not in a container, so not joined'}; {reaped} stale kernel(s) reaped",
            file=sys.stderr,
        )

    def health(self) -> dict[str, Any]:
        version = self.client.version().get("Version", "")
        return {
            "status": "ok", "docker": version,
            "runtimes": len(self.runtimes.containers()), "sessions": len(self.sessions.list()),
        }

    def serve_in_thread(self) -> threading.Thread:
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        return thread

    def shutdown(self) -> None:
        self.server.shutdown()
        self.server.server_close()

    def run(self) -> int:
        self.prepare()

        def stop(*_: object) -> None:
            threading.Thread(target=self.server.shutdown, daemon=True).start()

        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        try:
            self.server.serve_forever()
        finally:
            self.server.server_close()
        return 0


Route = tuple[str, re.Pattern[str], str]


def make_handler(bearer: str, service: Service):
    token = bearer.encode("utf-8")
    routes: list[Route] = [
        ("GET", re.compile(r"^/v1/runtimes$"), "list_runtimes"),
        ("POST", re.compile(r"^/v1/runtimes$"), "create_runtime"),
        ("GET", re.compile(r"^/v1/runtimes/(?P<runtime>[a-f0-9]+)$"), "get_runtime"),
        ("POST", re.compile(r"^/v1/runtimes/(?P<runtime>[a-f0-9]+)/start$"), "start_runtime"),
        ("POST", re.compile(r"^/v1/runtimes/(?P<runtime>[a-f0-9]+)/stop$"), "stop_runtime"),
        ("DELETE", re.compile(r"^/v1/runtimes/(?P<runtime>[a-f0-9]+)$"), "remove_runtime"),
        ("GET", re.compile(r"^/v1/runtimes/(?P<runtime>[a-f0-9]+)/sessions$"), "list_sessions"),
        ("POST", re.compile(r"^/v1/runtimes/(?P<runtime>[a-f0-9]+)/sessions$"), "open_session"),
        ("GET", re.compile(r"^/v1/sessions$"), "list_all_sessions"),
        ("GET", re.compile(r"^/v1/sessions/(?P<session>s-[a-f0-9]+)$"), "get_session"),
        ("DELETE", re.compile(r"^/v1/sessions/(?P<session>s-[a-f0-9]+)$"), "close_session"),
        ("POST", re.compile(r"^/v1/sessions/(?P<session>s-[a-f0-9]+)/interrupt$"), "interrupt"),
        ("POST", re.compile(r"^/v1/sessions/(?P<session>s-[a-f0-9]+)/execute$"), "execute"),
        ("POST", re.compile(r"^/v1/format$"), "format"),
        ("PUT", re.compile(r"^/v1/sessions/(?P<session>s-[a-f0-9]+)/files$"), "put_files"),
        ("GET", re.compile(r"^/v1/sessions/(?P<session>s-[a-f0-9]+)/files$"), "get_files"),
    ]

    class Handler(BaseHTTPRequestHandler):
        server_version = "calliopa-code"
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args) -> None:  # noqa: A002 - the base class's name
            pass

        # -- answering -------------------------------------------------------

        def _answer(self, status: int, body: bytes, content_type: str, headers: dict[str, str] | None = None) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def _json(self, status: int, value: Any, headers: dict[str, str] | None = None) -> None:
            self._answer(status, json.dumps(value).encode("utf-8"), "application/json", headers)

        def _words(self, status: int, message: str) -> None:
            self._json(status, {"error": message})

        def _authorized(self) -> bool:
            header = self.headers.get("Authorization", "")
            presented = header[7:] if header.startswith("Bearer ") else ""
            return hmac.compare_digest(presented.encode("utf-8"), token)

        def _body(self, limit: int) -> bytes:
            length = int(self.headers.get("Content-Length") or 0)
            if length > limit:
                raise Refused(413, f"the body is above {limit} bytes")
            return self.rfile.read(length) if length else b""

        def _json_body(self) -> dict[str, Any]:
            raw = self._body(MAX_JSON_BYTES)
            if not raw:
                return {}
            try:
                value = json.loads(raw)
            except json.JSONDecodeError as broken:
                raise Refused(400, f"the body is not JSON: {broken.msg}") from broken
            if not isinstance(value, dict):
                raise Refused(400, "the body is a JSON object")
            return value

        # -- dispatch --------------------------------------------------------

        def _dispatch(self) -> None:
            split = urllib.parse.urlsplit(self.path)
            self.query = urllib.parse.parse_qs(split.query)
            if split.path == "/health" and self.command in ("GET", "HEAD"):
                self._health()
                return
            if not self._authorized():
                self._words(401, "the code bearer is required")
                return
            for method, pattern, name in routes:
                match = pattern.match(split.path)
                if match is None:
                    continue
                if method != self.command:
                    continue
                try:
                    getattr(self, name)(**match.groupdict())
                except Refused as refused:
                    self._words(refused.status, refused.message)
                except DockerException as failure:
                    self._words(502, f"the daemon refused: {failure}")
                return
            if any(pattern.match(split.path) for _m, pattern, _n in routes):
                self._words(405, "not a method of this route")
                return
            self._words(404, "no such route")

        do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = _dispatch  # noqa: N815

        def _health(self) -> None:
            try:
                self._json(200, service.health())
            except DockerException:
                self._words(503, "the docker daemon is not answering")

        # -- runtimes --------------------------------------------------------

        def list_runtimes(self) -> None:
            records = service.runtimes.list()
            for record in records:
                record["sessions"] = service.sessions.list(record["id"])
            self._json(200, {"runtimes": records})

        def create_runtime(self) -> None:
            body = self._json_body()
            record = service.runtimes.create(
                str(body.get("name", "")), str(body.get("image", "")),
                str(body["kernelspec"]) if body.get("kernelspec") else None,
            )
            record["sessions"] = []
            self._json(202, record)

        def get_runtime(self, runtime: str) -> None:
            record = service.runtimes.get(runtime)
            record["sessions"] = service.sessions.list(runtime)
            self._json(200, record)

        def start_runtime(self, runtime: str) -> None:
            self._json(200, service.runtimes.start(runtime))

        def stop_runtime(self, runtime: str) -> None:
            self._json(200, service.runtimes.stop(runtime))

        def remove_runtime(self, runtime: str) -> None:
            open_sessions = service.sessions.list(runtime)
            wants = self.query.get("closeSessions", ["0"])[0] in ("1", "true")
            if open_sessions and not wants:
                raise Refused(409, f"{len(open_sessions)} session(s) are open in the runtime; close them or ask with closeSessions=1")
            service.runtimes.remove(runtime)
            self._json(200, {"removed": runtime, "sessionsClosed": len(open_sessions)})

        # -- sessions --------------------------------------------------------

        def list_sessions(self, runtime: str) -> None:
            service.runtimes.get(runtime)
            self._json(200, {"sessions": service.sessions.list(runtime)})

        def list_all_sessions(self) -> None:
            self._json(200, {"sessions": service.sessions.list()})

        def open_session(self, runtime: str) -> None:
            self._json(201, service.sessions.open(runtime).record())

        def get_session(self, session: str) -> None:
            self._json(200, service.sessions.get(session).record())

        def close_session(self, session: str) -> None:
            service.sessions.close(session)
            self._json(200, {"closed": session})

        def interrupt(self, session: str) -> None:
            self._json(200, {"interrupted": service.sessions.interrupt(session)})

        # -- executing -------------------------------------------------------

        def execute(self, session: str) -> None:
            body = self._json_body()
            code = body.get("code")
            if not isinstance(code, str):
                raise Refused(400, "the body carries `code` as a string")
            collect = bool(body.get("collect", True))
            service.sessions.get(session)
            self.close_connection = True
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            lock = threading.Lock()

            def emit(event: dict[str, Any]) -> None:
                data = ("data: " + json.dumps(event) + "\n\n").encode("utf-8")
                with lock:
                    self.wfile.write(f"{len(data):x}\r\n".encode("ascii") + data + b"\r\n")
                    self.wfile.flush()

            try:
                done = service.sessions.execute(session, code, collect, emit)
            except Refused as refused:
                done = {"event": "done", "status": "refused", "error": refused.message, "files": []}
            except DockerException as failure:
                done = {"event": "done", "status": "refused", "error": f"the daemon refused: {failure}", "files": []}
            emit(done)
            with lock:
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()

        # -- formatting ------------------------------------------------------

        def format(self) -> None:
            """Forward to the formatter's container and answer what it said.

            The only caller is the kernel, on behalf of a settled edit or an
            acceptance. It never sees a failure: a formatter that is down, slow
            or unhappy with the source is answered as *unchanged*, because the
            block is saved either way and the person is told nothing.
            BO_0296_003"""
            body = self._json_body()
            source = body.get("source")
            if not isinstance(source, str):
                raise Refused(400, "source is the code as text")
            language = body.get("language")
            if language is not None and not isinstance(language, str):
                raise Refused(400, "language is a word or nothing")
            self._json(200, format_source(service.formatting, source, language))

        # -- files -----------------------------------------------------------

        def put_files(self, session: str) -> None:
            archive = self._body(service.caps.copy_max_bytes)
            self._json(200, service.sessions.put_files(session, archive))

        def get_files(self, session: str) -> None:
            since = self.query.get("since", [""])[0]
            if not since:
                raise Refused(400, "`since` names the execution whose files are asked for")
            files, chunks = service.sessions.files_archive(session, since)
            self.close_connection = True
            self.send_response(200)
            self.send_header("Content-Type", "application/x-tar")
            self.send_header("X-Calliopa-Files", json.dumps(files))
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            for chunk in chunks:
                self.wfile.write(f"{len(chunk):x}\r\n".encode("ascii") + chunk + b"\r\n")
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()

    return Handler


def main() -> int:
    bearer = read_bearer(os.environ.get("CALLIOPA_CODE_BEARER_FILE", "/run/secrets/calliopa/code_bearer"))
    port = int(os.environ.get("CALLIOPA_CODE_PORT", "8098"))
    caps = Caps.from_env(os.environ)
    workdir = os.environ.get("CALLIOPA_CODE_WORKDIR") or "/calliopa"
    scope = os.environ.get("CALLIOPA_CODE_SCOPE") or "stack"
    try:
        client = docker.DockerClient(base_url=os.environ.get("DOCKER_HOST") or "unix:///var/run/docker.sock")
        client.ping()
    except DockerException as failure:
        raise SystemExit(f"code: the docker daemon is not reachable: {failure}") from failure
    # Where the formatter is. Absent, the format route answers every source
    # unchanged, which is exactly what a tree with no formatter should do.
    # BO_0296_003
    formatting = Formatting(
        url=os.environ.get("CALLIOPA_CODE_FORMAT_URL") or "",
        bearer=read_optional_bearer(os.environ.get("CALLIOPA_CODE_FORMAT_BEARER_FILE") or ""),
    )
    service = Service(client, caps, bearer, port, workdir, scope, formatting)
    print(
        f"code: serving on {port}; memory {caps.memory_bytes} cpus {caps.cpus:g} output {caps.output_max_bytes} "
        f"copy {caps.copy_max_bytes} runtimes {caps.max_runtimes} timeout {caps.execution_timeout_s:g}s",
        file=sys.stderr,
    )
    return service.run()


if __name__ == "__main__":
    sys.exit(main())
