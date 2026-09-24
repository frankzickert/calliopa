#!/usr/bin/env python3
"""The media service: one HTTP surface over the ported generators.

The extension's server half is its only caller. It holds the vendor CLIs and their credentials
so nothing else does, and it is the one place in Calliopa a paid call is made.

**Nothing bills without a press** (`docs/system/media-service.md`). This service makes a paid
call only for a request the extension's human-session route produced, and it never re-submits a
job on its own: a failure after the job exists keeps its id, and `collect` takes it again without
paying. `quote` is free — it is the adapters' own `--dry-run`.

Standard library only, as the adapters are.
"""

from __future__ import annotations

import base64
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import urllib.parse
import uuid
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

SERVICE_DIR = Path(__file__).resolve().parent
ADAPTER_DIR = SERVICE_DIR / "adapters"
STATE_DIR = Path(os.environ.get("CALLIOPA_MEDIA_STATE", "/var/lib/calliopa/media"))
# The sign-in flow's two files live on a volume the kernel mounts too, because the served tree
# writes the request and reads the state itself — the way it already does for the agent's
# sign-in (`requestLogin` in `src/server/agent/adapters.ts`). Nothing here serves them.
CONFIG_DIR = Path(os.environ.get("CALLIOPA_MEDIA_CONFIG_DIR", "/var/lib/calliopa/media-config"))
BEARER_FILE = os.environ.get("CALLIOPA_MEDIA_BEARER_FILE", "/run/secrets/calliopa/media_bearer")
PYTHON = os.environ.get("CALLIOPA_MEDIA_PYTHON", sys.executable)

EXIT_OK = 0
EXIT_INVALID = 2
EXIT_TEMPORARY = 75

JOB_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


# --------------------------------------------------------------------------- #
# the adapters
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Adapter:
    """One generator: a service, a kind, and the module that makes it."""

    service: str
    kind: str                     # "image" or "video"
    module: str                   # directory under adapters/
    entry: str                    # module file inside it
    open_set: bool = False        # the model is a free parameter, not a closed set

    @property
    def path(self) -> Path:
        return ADAPTER_DIR / self.module / self.entry


ADAPTERS: tuple[Adapter, ...] = (
    Adapter("higgsfield", "image", "higgsfield-image", "higgsfield_image.py"),
    # The Higgsfield job type is a parameter by the adapter's own design, so its video set is open.
    Adapter("higgsfield", "video", "higgsfield-seedance", "seedance.py", open_set=True),
    Adapter("openart", "image", "openart-seedream", "seedream.py"),
    Adapter("openart", "video", "openart-seedance", "seedance.py"),
)

_loaded: dict[str, Any] = {}
_load_lock = threading.Lock()


def _load_beside(name: str) -> Any:
    """A module shipped beside this one, loaded by path as the adapters are."""
    spec = importlib.util.spec_from_file_location(f"_calliopa_media_{name}", SERVICE_DIR / f"{name}.py")
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


options = _load_beside("options")


def kind_of(service: str, model: str) -> str:
    """Whether a model makes a picture or a moving picture, read from the adapters."""
    for adapter in ADAPTERS:
        if adapter.service != service:
            continue
        if any(named["model"] == model for named in models_of(adapter)):
            return adapter.kind
    # An open set names its kind by the adapter that owns it; a video set is the open one.
    for adapter in ADAPTERS:
        if adapter.service == service and adapter.open_set:
            return adapter.kind
    return "image"


def adapter_module(adapter: Adapter) -> Any:
    """Load an adapter by path, the way the adapters load each other."""
    with _load_lock:
        held = _loaded.get(adapter.module)
        if held is not None:
            return held
        name = f"_calliopa_media_{adapter.module.replace('-', '_')}"
        spec = importlib.util.spec_from_file_location(name, adapter.path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"cannot load adapter {adapter.module}")
        module = importlib.util.module_from_spec(spec)
        # Registered before it runs: an adapter's dataclasses resolve their own module by name.
        sys.modules[name] = module
        spec.loader.exec_module(module)
        _loaded[adapter.module] = module
        return module


def models_of(adapter: Adapter) -> list[dict[str, Any]]:
    """The model identifiers an adapter knows, read from the adapter rather than restated."""
    module = adapter_module(adapter)
    table = getattr(module, "MODELS", None)
    default = getattr(module, "DEFAULT_MODEL", None) or getattr(module, "MODEL", None)
    names: list[str]
    if isinstance(table, dict) and table:
        names = sorted(table)
    else:
        names = sorted({name for name in (default, getattr(module, "MODEL", None)) if name})
    return [{"model": name, "kind": adapter.kind, "default": name == default} for name in names]


# --------------------------------------------------------------------------- #
# running one
# --------------------------------------------------------------------------- #

@dataclass
class Outcome:
    """What an adapter answered: its own result object, plus how it exited."""

    status: str                   # "ok" | "invalid" | "retry" | "failed"
    code: int
    result: dict[str, Any] = field(default_factory=dict)
    stderr: str = ""

    def to_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {"status": self.status, "exit": self.code, **self.result}
        if self.status != "ok" and self.stderr and not self.result:
            body["error"] = {"message": self.stderr.strip()[-2000:]}
        return body


def status_of(code: int) -> str:
    if code == EXIT_OK:
        return "ok"
    if code == EXIT_INVALID:
        return "invalid"
    if code == EXIT_TEMPORARY:
        return "retry"
    return "failed"


def run_adapter(adapter: Adapter, argv: list[str], *, timeout: float = 1800.0,
                runner: Callable[..., subprocess.CompletedProcess] | None = None) -> Outcome:
    """One adapter call. The contract is one JSON object on stdout and the exit code."""
    call = runner or subprocess.run
    completed = call([PYTHON, str(adapter.path), *argv], capture_output=True, text=True,
                     timeout=timeout, cwd=str(adapter.path.parent))
    result: dict[str, Any] = {}
    text = (completed.stdout or "").strip()
    if text:
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                result = parsed
        except json.JSONDecodeError:
            result = {}
    return Outcome(status_of(completed.returncode), completed.returncode, result,
                   completed.stderr or "")


REFERENCE_SUFFIX = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
                    "video/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/wav": ".wav"}


def materialize_references(body: dict[str, Any], area: Path) -> None:
    """A reference arrives as bytes and reaches the adapter as a file.

    The extension reads the blob through CCGW — nothing here holds a graph credential — and sends
    what it read. The adapters take `@alias=PATH`, so the bytes land in this job's own directory
    and go with it when the job is submitted (`drop_references`).
    """
    for reference in body.get("references") or []:
        encoded = reference.get("bytes")
        if not encoded or reference.get("path"):
            continue
        alias = str(reference.get("alias") or "").strip()
        if not alias:
            raise Refusal("every reference needs an alias and a path")
        try:
            raw = base64.b64decode(encoded, validate=True)
        except (ValueError, TypeError):
            raise Refusal(f"reference @{alias} is not base64")
        if not raw:
            raise Refusal(f"reference @{alias} carries no bytes")
        area.mkdir(parents=True, exist_ok=True)
        suffix = REFERENCE_SUFFIX.get(str(reference.get("mediaType") or ""), "")
        path = area / f"{alias}{suffix}"
        path.write_bytes(raw)
        reference["path"] = str(path)


def drop_references(area: Path) -> None:
    """The bytes go once the job is submitted; the provider holds what it needs."""
    shutil.rmtree(area, ignore_errors=True)


def references_area(identity: str) -> Path:
    return jobs_dir() / "references" / identity


def axis_argv(adapter: Adapter | None, axis: str, value: str) -> list[str]:
    """How one chosen axis reaches its adapter.

    `higgsfield-image` and the two video adapters take named flags; `openart-seedream` takes
    `--param KEY=VALUE` under the vendor's own key, which its help points at the very form
    `BO_0279_001` reads. Sent as a flag it is not a flag that adapter has, and argparse answers
    with its usage — which is what every chosen OpenArt axis got. BO_0279_003
    """
    if adapter is not None and adapter.module in options.TAKES_PARAMS:
        return ["--param", f"{options.vendor_key(adapter.service, axis)}={value}"]
    return [f"--{axis}", value]


def shortest_clip(adapter: Adapter) -> int:
    """The least a video adapter will make, read from the adapter rather than restated.

    A video needs a duration — *"--duration is required for a new clip"* — and nothing upstream
    asks for one, so every video generation would be refused before a job existed. The default is
    the shortest the adapter takes, because duration is what a clip costs and a press that did not
    choose should spend the least. BO_0273_044
    """
    module = adapter_module(adapter)
    span = getattr(module, "DURATION_RANGE", None)
    return span.start if isinstance(span, range) else 4


def request_argv(body: dict[str, Any], output: Path, *, dry_run: bool,
                 adapter: Adapter | None = None) -> list[str]:
    """The adapters' shared CLI, built from one request shape."""
    argv: list[str] = ["--output", str(output)]
    prompt = str(body.get("prompt") or "").strip()
    if not prompt:
        raise Refusal("a prompt is required")
    argv += ["--prompt", prompt]
    model = body.get("model")
    if model:
        argv += ["--model", str(model)]
    for reference in body.get("references") or []:
        alias = str(reference.get("alias") or "").strip()
        path = str(reference.get("path") or "").strip()
        if not alias or not path:
            raise Refusal("every reference needs an alias and a path")
        # A video is made from a picture, and the adapters take that picture as the clip's first
        # frame under its own flag: `--reference` is material the prompt may name, `--start-image`
        # is what the film opens on. Both adapters spell it the same way. BO_0273_045
        flag = "--start-image" if reference.get("role") == "start" else "--reference"
        argv += [flag, f"@{alias}={path}"]
    options = body.get("options") or {}
    for name, value in options.items():
        if value is None:
            continue
        argv += axis_argv(adapter, str(name), str(value))
    if adapter is not None and adapter.kind == "video" and options.get("duration") is None:
        argv += ["--duration", str(shortest_clip(adapter))]
    if dry_run:
        argv.append("--dry-run")
    return argv


# --------------------------------------------------------------------------- #
# jobs
# --------------------------------------------------------------------------- #

class Refusal(Exception):
    """A request this service will not send. Nothing is spent."""


def jobs_dir() -> Path:
    path = STATE_DIR / "jobs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_job(record: dict[str, Any]) -> None:
    path = jobs_dir() / f"{record['id']}.json"
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(record))
    temporary.replace(path)


def read_job(identity: str) -> dict[str, Any] | None:
    if not JOB_ID.match(identity):
        return None
    path = jobs_dir() / f"{identity}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def adapter_for(service: str, kind: str) -> Adapter:
    for adapter in ADAPTERS:
        if adapter.service == service and adapter.kind == kind:
            return adapter
    raise Refusal(f"no generator for {service!r} and {kind!r}")


def output_path(adapter: Adapter, identity: str) -> Path:
    """What one job's output is called.

    The adapters keep `filmset`'s convention that an output is versioned and refuse a name that is
    not — *"--output must be versioned, e.g. panel_v01.png"* — and they refuse a suffix that is not
    their kind's. Every job here is its own, so the version is always the first. One function
    because the quote takes the same path as the generation: it once passed `quote.unused` and
    every quote was refused before the adapter read anything else. BO_0273_041 BO_0273_043
    """
    suffix = ".png" if adapter.kind == "image" else ".mp4"
    return jobs_dir() / f"{identity}_v01{suffix}"


def start_generation(body: dict[str, Any], *, runner: Callable[..., Any] | None = None) -> dict[str, Any]:
    """Open the record before the adapter is asked, so a refusal still leaves something to read."""
    adapter = adapter_for(str(body.get("service") or ""), str(body.get("kind") or ""))
    identity = uuid.uuid4().hex
    output = output_path(adapter, identity)
    area = references_area(identity)
    materialize_references(body, area)
    argv = request_argv(body, output, dry_run=False, adapter=adapter)
    record = {"id": identity, "service": adapter.service, "kind": adapter.kind,
              "model": body.get("model"), "state": "running", "output": str(output),
              "jobId": None, "result": None}
    write_job(record)

    def work() -> None:
        try:
            outcome = run_adapter(adapter, argv, runner=runner)
        finally:
            drop_references(area)
        held = read_job(identity) or record
        held["result"] = outcome.to_dict()
        held["state"] = "completed" if outcome.status == "ok" else outcome.status
        held["jobId"] = (outcome.result.get("job") or {}).get("id") if isinstance(outcome.result.get("job"), dict) else None
        write_job(held)

    threading.Thread(target=work, daemon=True).start()
    return record


def collect(identity: str, *, runner: Callable[..., Any] | None = None) -> dict[str, Any]:
    """Take a job that is already paid for. Never a second submission."""
    held = read_job(identity)
    if held is None:
        raise Refusal("no such job")
    if not held.get("jobId"):
        raise Refusal("this job has no provider id to collect; it was never submitted")
    adapter = adapter_for(held["service"], held["kind"])
    outcome = run_adapter(adapter, ["--job-id", str(held["jobId"]), "--output", held["output"]],
                          runner=runner)
    held["result"] = outcome.to_dict()
    held["state"] = "completed" if outcome.status == "ok" else outcome.status
    write_job(held)
    return held


def roster(*, runner: Callable[..., Any] | None = None) -> list[dict[str, Any]]:
    """Every service, whether its credential answers, and the models it knows."""
    services: dict[str, dict[str, Any]] = {}
    for adapter in ADAPTERS:
        entry = services.setdefault(adapter.service,
                                    {"service": adapter.service, "signedIn": False,
                                     "reason": None, "models": [], "openSet": {}})
        entry["models"].extend(models_of(adapter))
        entry["openSet"][adapter.kind] = adapter.open_set
    for name, entry in services.items():
        held, reason = credential_of(name, runner=runner)
        entry["signedIn"] = held
        entry["reason"] = reason
        # Only asked of a service that answers, and only of one that has them:
        # the probe is a CLI call, and a signed-out account has nothing to list.
        entry["workspaces"] = workspaces_of(name, runner=runner) if held else None
    return [services[name] for name in sorted(services)]


# --------------------------------------------------------------------------- #
# workspaces
# --------------------------------------------------------------------------- #

def workspaces_of(service: str, *, runner: Callable[..., Any] | None = None) -> list[dict[str, Any]] | None:
    """The account's workspaces, or `None` for a service that has no such thing.

    Higgsfield submits a generation into a workspace and refuses one without — *No workspace
    selected* — so the owner has to pick, and the id is only knowable once signed in. Free: the
    CLI's own listing, never a generation. BO_0273_042
    """
    if service != "higgsfield":
        return None
    call = runner or subprocess.run
    binary = os.environ.get("HIGGSFIELD_BIN", "higgsfield")
    try:
        completed = call([binary, "workspace", "list", "--json"],
                         capture_output=True, text=True, timeout=60.0)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    if completed.returncode != 0:
        return []
    try:
        listed = json.loads((completed.stdout or "").strip() or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(listed, list):
        return []
    workspaces = []
    for entry in listed:
        if not isinstance(entry, dict) or not entry.get("id"):
            continue
        workspaces.append({
            "id": str(entry["id"]),
            # The private account's workspace carries no name, and the CLI shows it as
            # *Private*; a row with an empty label would be unpickable.
            "name": str(entry.get("name") or "Private"),
            "plan": entry.get("plan_type"),
            "credits": entry.get("credits"),
            "selected": bool(entry.get("is_selected")),
        })
    return workspaces


def choose_workspace(service: str, workspace: str, *,
                     runner: Callable[..., Any] | None = None) -> dict[str, Any]:
    """Select one of the account's workspaces.

    Checked against the listing first, because `higgsfield workspace set` takes any string at
    all and exits `0` — a typo would be accepted here and then refuse every generation with the
    same opaque *No workspace selected* the empty case gives. BO_0273_042
    """
    listed = workspaces_of(service, runner=runner)
    if listed is None:
        raise Refusal(f"{service} has no workspaces to choose from")
    if not listed:
        raise Refusal("no workspaces were listed; sign in first")
    if not any(entry["id"] == workspace for entry in listed):
        raise Refusal(f"{workspace!r} is not one of this account's workspaces")
    call = runner or subprocess.run
    binary = os.environ.get("HIGGSFIELD_BIN", "higgsfield")
    try:
        completed = call([binary, "workspace", "set", workspace],
                         capture_output=True, text=True, timeout=60.0)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        raise Refusal(f"the {service} CLI did not answer")
    if completed.returncode != 0:
        raise Refusal((completed.stderr or completed.stdout or "").strip()[-500:]
                      or "the workspace was refused")
    return {"service": service, "workspaces": workspaces_of(service, runner=runner)}


def credential_of(service: str, *, runner: Callable[..., Any] | None = None) -> tuple[bool, str | None]:
    """A free probe: the adapters' own no-cost calls, never a generation."""
    call = runner or subprocess.run
    if service == "openart":
        binary = os.environ.get("OPENART_BIN", "openart")
        argv = [binary, "account"]
        advice = "run `openart login`"
    elif service == "higgsfield":
        binary = os.environ.get("HIGGSFIELD_BIN", "higgsfield")
        # `auth token`, not `auth status`: there is no status subcommand, and
        # the CLI answers an unknown one by printing help and exiting 0 — which
        # read as signed in on a container holding no credential at all. It
        # exits 2 with *Not authenticated* when there is none. The token it
        # prints is never read, only its exit code. Found by running the built
        # image, 2026-09-21 (`BO_0273_022`).
        argv = [binary, "auth", "token"]
        advice = "run `higgsfield auth login`"
    else:
        return False, f"unknown service {service!r}"
    try:
        completed = call(argv, capture_output=True, text=True, timeout=60.0)
    except FileNotFoundError:
        return False, f"the {service} CLI is not installed in this image"
    except subprocess.TimeoutExpired:
        return False, f"the {service} CLI did not answer"
    if completed.returncode == 0:
        return True, None
    return False, advice


# --------------------------------------------------------------------------- #
# the surface
# --------------------------------------------------------------------------- #

def result_bytes(identity: str) -> tuple[bytes, str] | None:
    """The bytes a finished job made, and what they are.

    The adapters write their output to a file; the extension needs those bytes to upload as a
    blob through CCGW, and it reaches them only through this service. Answered once the job is
    completed and not before, so a half-written file is never served. BO_0273_017
    """
    held = read_job(identity)
    if held is None or held.get("state") != "completed":
        return None
    output = Path(str(held.get("output") or ""))
    if not output.exists() or not output.is_file():
        return None
    media_type = "video/mp4" if held.get("kind") == "video" else "image/png"
    return output.read_bytes(), media_type


def bearer() -> str:
    path = Path(BEARER_FILE)
    if not path.exists():
        raise RuntimeError(f"no bearer at {path}; the stack's bootstrap writes it")
    return path.read_text().strip()


class Handler(BaseHTTPRequestHandler):
    server_version = "calliopa-media"
    runner: Callable[..., Any] | None = None

    def log_message(self, fmt: str, *args: Any) -> None:            # quieter than the default
        sys.stderr.write("media: " + fmt % args + "\n")

    def answer(self, code: int, body: Any) -> None:
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def authorized(self) -> bool:
        if self.path == "/health":
            return True
        given = self.headers.get("Authorization", "")
        return given.startswith("Bearer ") and given[7:].strip() == bearer()

    def read_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            parsed = json.loads(self.rfile.read(length).decode())
        except json.JSONDecodeError:
            raise Refusal("the body is not JSON")
        return parsed if isinstance(parsed, dict) else {}

    def do_GET(self) -> None:                                        # noqa: N802
        if self.path == "/health":
            return self.answer(200, {"status": "ok"})
        if not self.authorized():
            return self.answer(401, {"error": "unauthorized"})
        if self.path == "/v1/services":
            return self.answer(200, {"services": roster(runner=self.runner)})
        if self.path.startswith("/v1/models/"):
            # `/v1/models/<service>/<model>`: what that model takes, asked of the vendor.
            # Free — a description, never a generation. BO_0279_001
            rest = self.path[len("/v1/models/"):].split("/")
            if len(rest) != 2 or not rest[0] or not rest[1]:
                return self.answer(404, {"error": "name a service and a model"})
            service, model = rest[0], urllib.parse.unquote(rest[1])
            known = [one for one in ADAPTERS if one.service == service]
            if not known:
                return self.answer(404, {"error": f"unknown service {service!r}"})
            kind = kind_of(service, model)
            return self.answer(200, options.describe(service, model, kind, runner=self.runner))
        if self.path.startswith("/v1/generations/") and self.path.endswith("/file"):
            identity = self.path[len("/v1/generations/"):-len("/file")]
            made = result_bytes(identity)
            if made is None:
                return self.answer(404, {"error": "no bytes for that job yet"})
            payload, media_type = made
            self.send_response(200)
            self.send_header("Content-Type", media_type)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if self.path.startswith("/v1/generations/"):
            held = read_job(self.path.rsplit("/", 1)[-1])
            if held is None:
                return self.answer(404, {"error": "no such job"})
            return self.answer(200, held)
        self.answer(404, {"error": "no such route"})

    def do_POST(self) -> None:                                       # noqa: N802
        if not self.authorized():
            return self.answer(401, {"error": "unauthorized"})
        try:
            body = self.read_body()
            if self.path == "/v1/quote":
                adapter = adapter_for(str(body.get("service") or ""), str(body.get("kind") or ""))
                area = references_area("quote-" + uuid.uuid4().hex)
                try:
                    materialize_references(body, area)
                    # A dry run writes nothing, but the name still has to be one the
                    # adapter accepts, so it is built exactly as a generation's is.
                    argv = request_argv(body, output_path(adapter, "quote-" + uuid.uuid4().hex),
                                        dry_run=True, adapter=adapter)
                    return self.answer(200, run_adapter(adapter, argv, runner=self.runner).to_dict())
                finally:
                    drop_references(area)
            if self.path == "/v1/workspaces":
                return self.answer(200, choose_workspace(
                    str(body.get("service") or ""), str(body.get("workspace") or "").strip(),
                    runner=self.runner))
            if self.path == "/v1/generations":
                return self.answer(202, start_generation(body, runner=self.runner))
            if self.path.endswith("/collect") and self.path.startswith("/v1/generations/"):
                identity = self.path[len("/v1/generations/"):-len("/collect")]
                return self.answer(200, collect(identity, runner=self.runner))
        except Refusal as refusal:
            return self.answer(400, {"error": str(refusal)})
        self.answer(404, {"error": "no such route"})


def main() -> int:
    port = int(os.environ.get("CALLIOPA_MEDIA_PORT", "8095"))
    bearer()                                                         # fail at start, not per call
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    sys.stderr.write(f"media: serving on {port}\n")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
