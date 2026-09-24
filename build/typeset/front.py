#!/usr/bin/env python3
"""The typesetting service's front: a document's projection in, a manuscript out.

`POST /v1/manuscripts` takes a venue, a Pandoc JSON document AST whose metadata
carries the front matter, the cited works as CSL-JSON and the figures' bytes,
and answers the LaTeX source, its `.bib` and the PDF typeset from them, with
the engine's warnings and errors in order. The `.bib` is Pandoc's own
conversion of the CSL-JSON the bibliography stores, the citations are natbib
commands `bibtex` resolves with the venue's style, and the PDF is that source
typeset and nothing else — so the LaTeX a venue takes and the PDF a reader
takes can never disagree.

The input is untrusted: a person's TeX in an equation reaches the engine
verbatim. Every request runs in a fresh directory wiped when it ends, every
Pandoc and TeX process runs as an unprivileged user with shell escape off and
kpathsea's paranoid file rules, and nothing reaches the web. `GET /health` is
open and says whether the engine is there; everything else needs the bearer
the bootstrap one-shot wrote. Standard library only. BO_0293_001
"""

from __future__ import annotations

import base64
import binascii
import hmac
import json
import os
import pwd
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# A manuscript with its figures is megabytes; 64 MiB either way is far above a
# paper and still far below anything that would hurt the caller.
MAX_REQUEST_BYTES = 64 * 1024 * 1024
MAX_ANSWER_BYTES = 64 * 1024 * 1024
# Three typesettings at once, eight waiting; the ninth is told the service is busy.
CONCURRENT = 3
WAITING = 8
# Under the kernel's `ext.tool` callback timeout (30 s), since a run's tool
# waits on the same route a person's press does.
DEFAULT_TIMEOUT_S = 25.0

VENUE_ID = re.compile(r"^[a-z][a-z0-9-]{0,39}$")
# A figure is named by its file alone: no directory, no dot file, nothing the
# manuscript's own files are called.
FILE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
RESERVED = {"manuscript.tex", "manuscript.pdf", "manuscript.log", "manuscript.aux", "manuscript.bbl", "manuscript.blg", "references.bib", "references.json", "ast.json"}
FIGURE_TYPES = {".png", ".jpg", ".jpeg", ".pdf"}

# The Pandoc this image carries reads and writes this AST version; an AST
# sent without one is given it.
PANDOC_API_VERSION = [1, 22, 1]


class Refused(Exception):
    """A request the service will not typeset, with the words to say why."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def read_bearer(path: str) -> str:
    """The bearer the bootstrap wrote, or a plain refusal to start."""
    try:
        with open(path, encoding="utf-8") as handle:
            bearer = handle.read().strip()
    except OSError:
        bearer = ""
    if not bearer:
        raise SystemExit(f"typeset: no bearer at {path}; the stack's bootstrap writes it")
    return bearer


def load_venues(root: Path) -> dict[str, dict]:
    """Every venue the image carries: a directory with its template and description."""
    venues: dict[str, dict] = {}
    if not root.is_dir():
        return venues
    for directory in sorted(root.iterdir()):
        template = directory / "template.latex"
        described = directory / "venue.json"
        if not (template.is_file() and described.is_file() and VENUE_ID.match(directory.name)):
            continue
        venue = json.loads(described.read_text(encoding="utf-8"))
        venue["template"] = str(template)
        venues[directory.name] = venue
    return venues


def read_request(body: bytes, venues: dict[str, dict]) -> dict:
    """The request as the service will typeset it, or a refusal in words."""
    try:
        request = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        raise Refused(400, "a manuscript request is JSON") from None
    if not isinstance(request, dict):
        raise Refused(400, "a manuscript request is a JSON object")
    venue = request.get("venue", "generic")
    if not isinstance(venue, str) or venue not in venues:
        raise Refused(400, f"no venue {venue!r}; this service carries {', '.join(sorted(venues)) or 'none'}")
    ast = request.get("ast")
    if not isinstance(ast, dict) or not isinstance(ast.get("blocks"), list):
        raise Refused(400, "ast is a Pandoc JSON document: an object carrying its blocks and its meta")
    ast.setdefault("pandoc-api-version", PANDOC_API_VERSION)
    ast.setdefault("meta", {})
    references = request.get("references", [])
    if not isinstance(references, list) or not all(isinstance(entry, dict) and isinstance(entry.get("id"), str) for entry in references):
        raise Refused(400, "references are the cited works as CSL-JSON, each with its id")
    files: dict[str, bytes] = {}
    for name, encoded in (request.get("files") or {}).items():
        if not isinstance(name, str) or not FILE_NAME.match(name) or name in RESERVED:
            raise Refused(400, f"a figure is named by its file alone: {name!r} is not one")
        if Path(name).suffix.lower() not in FIGURE_TYPES:
            raise Refused(400, f"{name} is not a figure this service typesets; it takes {', '.join(sorted(FIGURE_TYPES))}")
        try:
            files[name] = base64.b64decode(encoded, validate=True)
        except (binascii.Error, TypeError, ValueError):
            raise Refused(400, f"{name} is not base64") from None
    return {"venue": venues[venue], "venueId": venue, "ast": ast, "references": references, "files": files}


FILE_LINE_ERROR = re.compile(r"^\S+\.tex:\d+: ")


def warnings_of(log_text: str) -> list[str]:
    """The engine's errors and warnings, in order, as a reader wants them: a
    TeX error with the line it names — `! message` then `l.12`, or the
    `file:line: message` form `-file-line-error` writes — and each warning once."""
    lines = log_text.splitlines()
    found: list[str] = []
    for index, line in enumerate(lines):
        if FILE_LINE_ERROR.match(line):
            if line not in found:
                found.append(line.strip())
        elif line.startswith("!"):
            follow = next((candidate.strip() for candidate in lines[index + 1 : index + 3] if candidate.startswith("l.")), "")
            found.append(f"{line} {follow}".strip())
        elif "Warning" in line and line not in found:
            found.append(line.strip())
    return found[:200]


class Engine:
    """Runs one typesetting in its own directory, as the unprivileged user."""

    def __init__(self, timeout_s: float, user: str | None) -> None:
        self.timeout_s = timeout_s
        self.account = pwd.getpwnam(user) if user else None

    def _run(self, argv: list[str], cwd: Path, remaining: float) -> subprocess.CompletedProcess:
        # TeX wraps its log at 79 characters; a reader wants each message whole.
        environment = {
            "PATH": "/usr/bin:/bin",
            "HOME": str(cwd),
            "openin_any": "p",
            "openout_any": "p",
            "TEXMFOUTPUT": str(cwd),
            "LANG": "C.UTF-8",
            "max_print_line": "10000",
            "error_line": "254",
            "half_error_line": "238",
        }
        extra = {}
        if self.account is not None:
            extra = {"user": self.account.pw_uid, "group": self.account.pw_gid, "extra_groups": []}
        return subprocess.run(  # noqa: S603 - the argv is ours, never the request's
            argv, cwd=cwd, env=environment, capture_output=True, timeout=max(remaining, 1.0), check=False, **extra
        )

    def typeset(self, request: dict) -> dict:
        import time

        started = time.monotonic()
        remaining = lambda: self.timeout_s - (time.monotonic() - started)  # noqa: E731
        work = Path(tempfile.mkdtemp(prefix="manuscript-"))
        try:
            if self.account is not None:
                os.chown(work, self.account.pw_uid, self.account.pw_gid)
            for name, data in request["files"].items():
                (work / name).write_bytes(data)
            (work / "ast.json").write_text(json.dumps(request["ast"]), encoding="utf-8")
            (work / "references.json").write_text(json.dumps(request["references"]), encoding="utf-8")
            if self.account is not None:
                for entry in work.iterdir():
                    os.chown(entry, self.account.pw_uid, self.account.pw_gid)
            log: list[str] = []
            bib = ""
            if request["references"]:
                converted = self._run(["pandoc", "--sandbox", "-f", "csljson", "-t", "bibtex", "references.json", "-o", "references.bib"], work, remaining())
                if converted.returncode != 0:
                    log.append("pandoc could not convert the references: " + converted.stderr.decode("utf-8", "replace").strip())
                else:
                    bib = (work / "references.bib").read_text(encoding="utf-8")
            venue = request["venue"]
            argv = ["pandoc", "-f", "json", "-t", "latex", "--natbib", "--standalone", "--template", venue["template"], "ast.json", "-o", "manuscript.tex"]
            if bib:
                # natbib names the file without its extension; bibtex adds it.
                argv += ["-M", "bibliography=references", "-M", f"biblio-style={venue.get('bibliographyStyle', 'unsrtnat')}"]
            written = self._run(argv, work, remaining())
            if written.returncode != 0:
                log.append("pandoc could not write the LaTeX: " + written.stderr.decode("utf-8", "replace").strip())
                return {"outcome": "failed", "tex": "", "bib": bib, "log": log}
            tex = (work / "manuscript.tex").read_text(encoding="utf-8")
            try:
                built = self._run(
                    ["latexmk", "-pdf", "-f", "-interaction=nonstopmode", "-file-line-error", "-pdflatex=pdflatex -no-shell-escape %O %S", "manuscript.tex"],
                    work,
                    remaining(),
                )
            except subprocess.TimeoutExpired:
                log.append(f"the typesetting took longer than {self.timeout_s:.0f} seconds and was stopped")
                return {"outcome": "timed out", "tex": tex, "bib": bib, "log": log}
            engine_log = work / "manuscript.log"
            if engine_log.is_file():
                log += warnings_of(engine_log.read_text(encoding="latin-1"))
            pdf = work / "manuscript.pdf"
            if not pdf.is_file():
                if not log:
                    log.append(built.stderr.decode("utf-8", "replace").strip()[-2000:])
                return {"outcome": "failed", "tex": tex, "bib": bib, "log": log}
            answer = {"outcome": "ok" if built.returncode == 0 else "errors", "tex": tex, "bib": bib, "log": log, "pdf": base64.b64encode(pdf.read_bytes()).decode("ascii")}
            return answer
        except subprocess.TimeoutExpired:
            return {"outcome": "timed out", "tex": "", "bib": "", "log": [f"the typesetting took longer than {self.timeout_s:.0f} seconds and was stopped"]}
        finally:
            shutil.rmtree(work, ignore_errors=True)


def make_handler(bearer: str, venues: dict[str, dict], engine: Engine, slots: threading.BoundedSemaphore, queue: threading.BoundedSemaphore):
    token = bearer.encode("utf-8")

    class Handler(BaseHTTPRequestHandler):
        server_version = "calliopa-typeset"
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args) -> None:  # noqa: A002
            pass

        def _answer(self, status: int, payload: dict) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _words(self, status: int, message: str) -> None:
            self._answer(status, {"error": message})

        def _authorized(self) -> bool:
            header = self.headers.get("Authorization", "")
            presented = header[7:] if header.startswith("Bearer ") else ""
            return hmac.compare_digest(presented.encode("utf-8"), token)

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                present = shutil.which("pandoc") is not None and shutil.which("latexmk") is not None
                if not present:
                    self._words(503, "the engine is not installed")
                    return
                # The venues by id and name: the extension offers them from
                # here, so the service is the one list. BO_0293_020
                listed = [{"id": key, "name": venues[key].get("name", key)} for key in sorted(venues)]
                self._answer(200, {"status": "ok", "engine": "pandoc", "pandocApiVersion": PANDOC_API_VERSION, "venues": listed})
                return
            if not self._authorized():
                self._words(401, "the typesetting bearer is required")
                return
            self._words(404, f"no route {self.path}")

        def do_POST(self) -> None:  # noqa: N802
            if not self._authorized():
                self._words(401, "the typesetting bearer is required")
                return
            if self.path != "/v1/manuscripts":
                self._words(404, f"no route {self.path}")
                return
            try:
                length = int(self.headers.get("Content-Length", ""))
            except ValueError:
                self._words(411, "a manuscript request says its length")
                return
            if length > MAX_REQUEST_BYTES:
                self._words(413, f"a manuscript request is at most {MAX_REQUEST_BYTES // (1024 * 1024)} MiB")
                return
            body = self.rfile.read(length)
            try:
                request = read_request(body, venues)
            except Refused as refused:
                self._words(refused.status, refused.message)
                return
            if not queue.acquire(blocking=False):
                self._words(503, "busy: too many manuscripts are waiting; try again shortly")
                return
            try:
                with slots:
                    answer = engine.typeset(request)
            finally:
                queue.release()
            answer["venue"] = request["venueId"]
            if len(answer.get("pdf", "")) * 3 // 4 > MAX_ANSWER_BYTES:
                self._words(502, "the manuscript is larger than the service answers")
                return
            self._answer(200, answer)

        def _refuse_method(self) -> None:
            if not self._authorized():
                self._words(401, "the typesetting bearer is required")
                return
            self._words(405, "the typesetting service answers GET /health and POST /v1/manuscripts")

        do_PUT = do_DELETE = do_PATCH = _refuse_method  # noqa: N815

    return Handler


def serve(bearer: str, venues: dict[str, dict], port: int, engine: Engine) -> ThreadingHTTPServer:
    slots = threading.BoundedSemaphore(CONCURRENT)
    queue = threading.BoundedSemaphore(CONCURRENT + WAITING)
    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(bearer, venues, engine, slots, queue))
    server.daemon_threads = True
    return server


def main() -> int:
    bearer = read_bearer(os.environ.get("CALLIOPA_TYPESET_BEARER_FILE", "/run/secrets/calliopa/typeset_bearer"))
    venues = load_venues(Path(os.environ.get("CALLIOPA_TYPESET_VENUES", "/opt/calliopa/typeset/venues")))
    if not venues:
        raise SystemExit("typeset: no venue carried; the image copies them")
    port = int(os.environ.get("CALLIOPA_TYPESET_PORT", "8094"))
    timeout_s = float(os.environ.get("CALLIOPA_TYPESET_TIMEOUT_S", str(DEFAULT_TIMEOUT_S)))
    user = os.environ.get("CALLIOPA_TYPESET_USER", "typeset") or None
    server = serve(bearer, venues, port, Engine(timeout_s, user))

    def stop(*_: object) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        server.serve_forever()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
