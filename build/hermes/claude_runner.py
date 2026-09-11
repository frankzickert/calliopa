#!/usr/bin/env python3
"""Claude Code as a Calliopa agent: one `claude -p` per run.

The kernel bridge speaks a small part of the Hermes gateway's runs API, and
this process speaks the same part, so a run the reader sends to Claude goes
through the bridge's event normalization, its status-poll backstop, its busy
refusal and its record keeping unchanged:

  POST /v1/runs              {input, instructions} -> {run_id}
  GET  /v1/runs/{id}         {status, error, model, billing}
  GET  /v1/runs/{id}/events  server-sent events, replayed from the start
  POST /v1/runs/{id}/stop
  GET  /health

Claude Code runs itself, not under a Hermes controller: Hermes's own Anthropic
OAuth provider bills extra-usage credits, while the CLI with
CLAUDE_CODE_OAUTH_TOKEN bills the plan. The CLI's own `rate_limit_event` says
which one a run used, and the run reports it as `billing`.

The run holds the kernel toolset and web search and web fetch, nothing else:
no terminal, no file tools. A tool call outside that set fails rather than
waiting for an approval no one can give, and the permission bypass is never
passed. BO_0089_007 BO_0228_001
"""

import json
import os
import re
import shutil
import signal
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERMES_HOME = os.environ.get("HERMES_HOME", "/var/lib/hermes")
CONFIG_DIR = os.environ.get("CALLIOPA_AGENT_CONFIG_DIR", "/var/lib/calliopa/agent-config")
KERNEL_TOOLS_URL = os.environ.get(
    "CALLIOPA_KERNEL_TOOLS_URL", "http://kernel:8090/__kernel/agent-tools"
)
KERNEL_BEARER_FILE = os.environ.get(
    "CALLIOPA_KERNEL_BEARER_FILE", os.path.join(HERMES_HOME, "kernel-bearer")
)
CLAUDE_ENV = os.path.join(CONFIG_DIR, "claude.env")
CLAUDE_BIN = os.environ.get("CALLIOPA_CLAUDE_BIN", "claude")
RUNS_DIR = os.environ.get("CALLIOPA_CLAUDE_RUNS_DIR", os.path.join(HERMES_HOME, "claude-runs"))
HOST = os.environ.get("CALLIOPA_CLAUDE_RUNNER_HOST", "0.0.0.0")
PORT = int(os.environ.get("CALLIOPA_CLAUDE_RUNNER_PORT", "8643"))

# The server name the kernel toolset is registered under. The bridge's suffix
# checks (`calliopa_workspace_check`) match the tool names it produces,
# `mcp__calliopa-kernel__<tool>`.
TOOLSET = "calliopa-kernel"
# What a run may reach besides the toolset. Codex's `web_search` is the
# parity this keeps (decided 2026-09-10); the terminal and the file tools stay
# off, since the instructions say only the calliopa_* tools touch Calliopa.
WEB_TOOLS = ("WebSearch", "WebFetch")
STOP_GRACE_SECONDS = 5
FINISHED_RUNS_KEPT = 20

SECRET_PATTERN = re.compile(r"sk-ant-[A-Za-z0-9_\-]{8,}")


def api_key():
    """The gateway's API bearer, which this runner answers under too."""
    key = os.environ.get("API_SERVER_KEY", "")
    if key:
        return key
    try:
        with open(os.path.join(HERMES_HOME, ".env")) as handle:
            for line in handle:
                name, _, value = line.strip().partition("=")
                if name == "API_SERVER_KEY":
                    return value
    except OSError:
        pass
    return ""


def read_env_file(path):
    """KEY=VALUE lines, as the login broker writes claude.env."""
    values = {}
    try:
        with open(path) as handle:
            for line in handle:
                name, sep, value = line.strip().partition("=")
                if sep and name and not name.startswith("#"):
                    values[name] = value
    except OSError:
        pass
    return values


def read_secret(path):
    try:
        with open(path) as handle:
            return handle.read().strip()
    except OSError:
        return ""


def redact(text):
    return SECRET_PATTERN.sub("[redacted]", text)


class Run:
    def __init__(self, goal, instructions):
        self.id = "crun-" + uuid.uuid4().hex[:16]
        self.goal = goal
        self.instructions = instructions
        self.status = "running"
        self.error = ""
        self.model = ""
        self.billing = ""
        self.events = []
        self.process = None
        self.stopping = False
        self.cond = threading.Condition()

    def emit(self, name, **data):
        with self.cond:
            self.events.append({"event": name, "run_id": self.id, **data})
            self.cond.notify_all()

    def finish(self, status, error=""):
        with self.cond:
            if self.status != "running":
                return
            self.status = status
            self.error = error
            if status == "completed":
                pass  # run.completed was emitted with its output by the reader
            elif status == "cancelled":
                self.events.append({"event": "run.cancelled", "run_id": self.id})
            else:
                self.events.append({"event": "run.failed", "run_id": self.id, "error": error})
            self.cond.notify_all()

    def summary(self):
        return {
            "run_id": self.id,
            "status": self.status,
            "error": self.error,
            "model": self.model,
            "billing": self.billing,
        }


class Runner:
    def __init__(self):
        self.lock = threading.Lock()
        self.runs = {}
        self.order = []
        self.active = None

    def start(self, goal, instructions):
        with self.lock:
            if self.active is not None and self.active.status == "running":
                return None, "a run is already active (run %s)" % self.active.id
            run = Run(goal, instructions)
            self.runs[run.id] = run
            self.order.append(run.id)
            self.active = run
            for stale in self.order[:-FINISHED_RUNS_KEPT]:
                if self.runs[stale].status != "running":
                    del self.runs[stale]
            self.order = [rid for rid in self.order if rid in self.runs]
        threading.Thread(target=execute, args=(run,), daemon=True).start()
        return run, ""

    def get(self, run_id):
        with self.lock:
            return self.runs.get(run_id)


def command(mcp_config, prompt_file):
    return [
        CLAUDE_BIN,
        "-p",
        "--output-format", "stream-json",
        "--verbose",
        "--tools", ",".join(WEB_TOOLS),
        "--strict-mcp-config",
        "--mcp-config", mcp_config,
        "--allowedTools", "mcp__" + TOOLSET, *WEB_TOOLS,
        "--permission-mode", "dontAsk",
        # A file rather than an argument: the instructions carry the selected
        # skills in full, and one argument is capped at 128 KiB.
        "--append-system-prompt-file", prompt_file,
    ]


def execute(run):
    """Run one `claude -p` and translate its stream into the bridge's events.

    The run's directory holds only what this runner wrote — the MCP config,
    the instructions and an empty working directory — and goes when the run
    does. The CLI keeps its own session record under its home.
    """
    try:
        run_claude(run)
    finally:
        shutil.rmtree(os.path.join(RUNS_DIR, run.id), ignore_errors=True)


def run_claude(run):
    token = read_env_file(CLAUDE_ENV).get("CLAUDE_CODE_OAUTH_TOKEN", "")
    if not token:
        run.finish("failed", "Claude Code is not signed in: no token in claude.env")
        return
    bearer = read_secret(KERNEL_BEARER_FILE)
    if not bearer:
        run.finish("failed", "the kernel toolset's bearer is missing, so Claude would hold no Calliopa tools")
        return

    home = os.path.join(RUNS_DIR, run.id)
    work = os.path.join(home, "work")
    os.makedirs(work, mode=0o700, exist_ok=True)
    mcp_config = os.path.join(home, "mcp.json")
    # The bearer is named, never written: the CLI expands the variable when it
    # connects, as Codex's registration reads its own from the environment.
    with open(mcp_config, "w") as handle:
        json.dump(
            {
                "mcpServers": {
                    TOOLSET: {
                        "type": "http",
                        "url": KERNEL_TOOLS_URL,
                        "headers": {"Authorization": "Bearer ${CALLIOPA_AGENT_TOOLS_BEARER}"},
                    }
                }
            },
            handle,
        )
    prompt_file = os.path.join(home, "instructions.md")
    with open(prompt_file, "w") as handle:
        handle.write(run.instructions or "")

    env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": HERMES_HOME,
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "CLAUDE_CODE_OAUTH_TOKEN": token,
        "CALLIOPA_AGENT_TOOLS_BEARER": bearer,
        # The CLI is pinned in the image; a self-update would run flags
        # nobody verified.
        "DISABLE_AUTOUPDATER": "1",
    }
    for passthrough in ("CALLIOPA_TEST_TRANSCRIPT", "CALLIOPA_TEST_HOLD_SECONDS"):
        if passthrough in os.environ:
            env[passthrough] = os.environ[passthrough]

    try:
        process = subprocess.Popen(
            command(mcp_config, prompt_file),
            cwd=work,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
    except OSError as error:
        run.finish("failed", "Claude Code could not start: %s" % error)
        return
    with run.cond:
        run.process = process
    if run.stopping:
        stop_process(process)

    stderr_tail = []

    def drain_stderr():
        for raw in process.stderr:
            stderr_tail.append(raw.decode("utf-8", "replace"))
            del stderr_tail[:-20]

    threading.Thread(target=drain_stderr, daemon=True).start()
    try:
        process.stdin.write((run.goal or "").encode("utf-8"))
        process.stdin.close()
    except OSError:
        pass

    reader = StreamReader(run)
    for raw in process.stdout:
        line = raw.decode("utf-8", "replace").strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except ValueError:
            continue
        outcome = reader.read(message)
        if outcome is not None:
            status, error = outcome
            if status == "failed" and process.poll() is None:
                stop_process(process)
            run.finish(status, error)
            break
    process.wait()
    if run.status == "running":
        if run.stopping:
            run.finish("cancelled")
        else:
            words = redact("".join(stderr_tail).strip())[-500:]
            run.finish(
                "failed",
                "Claude Code exited with status %s before finishing%s"
                % (process.returncode, (": " + words) if words else ""),
            )


class StreamReader:
    """The CLI's stream-json, read into the event names the bridge consumes.

    Assistant text is held until something follows it, because the final
    words arrive again as the result and travel once, in `run.completed`'s
    `output`, the way the gateway sends them.
    """

    def __init__(self, run):
        self.run = run
        self.pending = []
        self.tools = {}

    def flush(self):
        for text in self.pending:
            self.run.emit("response.output_text.delta", delta=text)
        self.pending = []

    def read(self, message):
        kind = message.get("type")
        if kind == "system" and message.get("subtype") == "init":
            self.run.model = message.get("model", "")
            servers = {s.get("name"): s.get("status") for s in message.get("mcp_servers") or []}
            status = servers.get(TOOLSET)
            if status != "connected":
                return (
                    "failed",
                    "the kernel toolset did not connect (%s), so the run was stopped before the model spent a turn"
                    % (status or "not configured"),
                )
            self.run.emit("run.started", model=self.run.model)
        elif kind == "rate_limit_event":
            info = message.get("rate_limit_info") or {}
            if "isUsingOverage" in info:
                self.run.billing = "extra-usage" if info.get("isUsingOverage") else "plan"
        elif kind == "assistant":
            for block in (message.get("message") or {}).get("content") or []:
                if block.get("type") == "text" and block.get("text"):
                    self.flush()
                    self.pending.append(block["text"])
                elif block.get("type") == "tool_use":
                    self.flush()
                    name = block.get("name", "")
                    self.tools[block.get("id")] = name
                    preview = json.dumps(block.get("input") or {})[:200]
                    self.run.emit("tool.started", tool=name, preview=preview)
        elif kind == "user":
            for block in (message.get("message") or {}).get("content") or []:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    name = self.tools.get(block.get("tool_use_id"), "")
                    self.run.emit("tool.completed", tool=name, error=bool(block.get("is_error")))
        elif kind == "result":
            result = message.get("result") or ""
            if message.get("is_error"):
                self.pending = []
                return ("failed", result or message.get("terminal_reason") or "Claude Code reported an error")
            if self.pending and self.pending[-1] == result:
                self.pending.pop()
            self.flush()
            self.run.emit(
                "run.completed",
                output=result,
                model=self.run.model,
                billing=self.run.billing,
            )
            return ("completed", "")
        return None


def stop_process(process):
    """SIGTERM to the process group, then SIGKILL after a grace period."""
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        return

    def reap():
        time.sleep(STOP_GRACE_SECONDS)
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass

    threading.Thread(target=reap, daemon=True).start()


RUNNER = Runner()
RUN_PATH = re.compile(r"^/v1/runs/([A-Za-z0-9\-]+)(/events|/stop)?$")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def reply(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        if self.close_connection:
            self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(payload)

    def authorized(self):
        key = api_key()
        if key and self.headers.get("Authorization", "") == "Bearer " + key:
            return True
        # The body goes unread, so the connection closes with the refusal: on
        # a kept-alive connection the unread body would be parsed as the next
        # request.
        self.close_connection = True
        self.reply(401, {"error": "unauthorized"})
        return False

    def body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return None

    def do_GET(self):
        if self.path == "/health":
            signed_in = bool(read_env_file(CLAUDE_ENV).get("CLAUDE_CODE_OAUTH_TOKEN"))
            self.reply(200, {"status": "ok", "signedIn": signed_in})
            return
        if not self.authorized():
            return
        match = RUN_PATH.match(self.path)
        run = RUNNER.get(match.group(1)) if match else None
        if run is None:
            self.reply(404, {"error": "no such run"})
            return
        if match.group(2) == "/events":
            self.stream(run)
        elif match.group(2) is None:
            with run.cond:
                self.reply(200, run.summary())
        else:
            self.reply(405, {"error": "method not allowed"})

    def do_POST(self):
        if not self.authorized():
            return
        # Read whatever was sent, used or not — the bridge sends `{}` with a
        # stop — so a kept-alive connection's next request starts clean.
        body = self.body()
        if self.path == "/v1/runs":
            if body is None or not isinstance(body.get("input"), str) or not body["input"].strip():
                self.reply(400, {"error": "a run needs an input"})
                return
            run, refusal = RUNNER.start(body["input"], str(body.get("instructions") or ""))
            if run is None:
                self.reply(409, {"error": refusal})
                return
            self.reply(202, {"run_id": run.id, "status": "started"})
            return
        match = RUN_PATH.match(self.path)
        if match and match.group(2) == "/stop":
            run = RUNNER.get(match.group(1))
            if run is None:
                self.reply(404, {"error": "no such run"})
                return
            with run.cond:
                run.stopping = True
                process = run.process
            if process is not None and process.poll() is None:
                stop_process(process)
            self.reply(200, {"run_id": run.id, "stopping": True})
            return
        self.reply(404, {"error": "not found"})

    def stream(self, run):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        sent = 0
        try:
            while True:
                with run.cond:
                    while sent >= len(run.events) and run.status == "running":
                        run.cond.wait(timeout=15)
                        if sent >= len(run.events) and run.status == "running":
                            break
                    batch = run.events[sent:]
                    done = run.status != "running"
                if not batch and not done:
                    # A comment line keeps an idle stream from being read as dead.
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
                    continue
                for event in batch:
                    self.wfile.write(b"data: " + json.dumps(event).encode("utf-8") + b"\n\n")
                sent += len(batch)
                self.wfile.flush()
                if done and sent >= len(run.events):
                    return
        except (BrokenPipeError, ConnectionResetError):
            return


def main():
    os.makedirs(RUNS_DIR, mode=0o700, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print("claude runner listening on %s:%d" % (HOST, PORT), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
