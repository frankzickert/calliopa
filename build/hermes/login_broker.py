#!/usr/bin/env python3
"""Subscription login broker and runtime probe for the agent container.

Signing in must be possible from the settings surface. The alternative is
`docker compose exec`, which means a human at a terminal on the machine, and an
agent nobody can configure from the product is an agent nobody configures.

The settings surface and this broker talk through files on the shared volume:

  login/request.json  {"runtime": "codex" | "claude-code"}   written by the app
  login/state.json    {runtime, status, url?, userCode?, awaiting?, output}
  login/code          the paste-back code for Claude's flow, written by the app
  adapters.json       what each runtime is: installed, version, authenticated

Codex uses its device-auth flow — a URL and a one-time code, with the CLI
polling. Claude uses `claude setup-token`, which prints a URL and takes a code
pasted back. Both are the runtimes' own flows, run here rather than reimplemented.

Nothing that could authenticate a second time is ever mirrored. The URL and the
one-time device code are; they are what the human must see and use once. The
long-lived Anthropic token the Claude flow prints is captured for the gateway
and redacted from everything the surface can read. CA_0022_006
"""

import json
import os
import re
import subprocess
import threading
import time

CONFIG_DIR = os.environ.get(
    "CALLIOPA_AGENT_CONFIG_DIR", "/var/lib/calliopa/agent-config"
)
LOGIN_DIR = os.path.join(CONFIG_DIR, "login")
REQUEST = os.path.join(LOGIN_DIR, "request.json")
STATE = os.path.join(LOGIN_DIR, "state.json")
CODE = os.path.join(LOGIN_DIR, "code")
ADAPTERS = os.path.join(CONFIG_DIR, "adapters.json")
HOME = os.environ.get("HERMES_HOME", "/var/lib/hermes")

LOGIN_TIMEOUT_SECONDS = 900
PROBE_INTERVAL_SECONDS = 30

URL_PATTERN = re.compile(r"https://\S+")
# Device-flow user codes render like XXXX-XXXX; the match is deliberately loose.
CODE_PATTERN = re.compile(r"\b([A-Z0-9]{4,8}-[A-Z0-9]{4,8})\b")
# Cursor-forward doubles as spacing in Ink layouts, so it becomes real spaces
# before everything else is stripped.
CURSOR_FORWARD = re.compile(r"\x1b\[(\d*)C")
ANSI_PATTERN = re.compile(
    r"\x1b\[[0-?]*[ -/]*[@-~]"  # CSI, any params/intermediates/final
    r"|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)"  # OSC
    r"|\x1b[()][0-9A-Za-z]"  # charset selection
    r"|\x1b[@-Z\\-_=><678]"  # two-character ESC sequences
    r"|\r"
)
# The long-lived Anthropic token must never reach the mirrored state: that file
# is what the settings surface renders.
SECRET_PATTERN = re.compile(r"sk-ant-[A-Za-z0-9_\-]{8,}")


def clean_terminal(text):
    text = CURSOR_FORWARD.sub(lambda match: " " * int(match.group(1) or "1"), text)
    return ANSI_PATTERN.sub("", text)


def write_json(path, value):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as handle:
        json.dump(value, handle)
    os.replace(tmp, path)


def write_state(state):
    write_json(STATE, state)


def run(command, timeout=60):
    """Runs a CLI and returns (exit code, output), never raising."""
    try:
        done = subprocess.run(
            command, capture_output=True, text=True, timeout=timeout
        )
        return done.returncode, ((done.stdout or "") + (done.stderr or "")).strip()
    except Exception as error:
        return 1, str(error)


def probe_codex():
    """Codex's own account of itself.

    `codex login status` is asked rather than a credential file being looked
    for, because a file that exists is not the same as a session that works —
    an expired or revoked one leaves the file exactly where it was.
    """
    code, version = run(["codex", "--version"], timeout=30)
    if code != 0:
        return {"installed": False, "version": "", "authenticated": False}
    status_code, status = run(["codex", "login", "status"], timeout=60)
    authenticated = status_code == 0 and "not logged in" not in status.lower()
    return {
        "installed": True,
        "version": version.splitlines()[0] if version else "",
        "authenticated": authenticated,
    }


def probe_claude():
    """Claude Code's own account of itself, which it answers as JSON."""
    code, version = run(["claude", "--version"], timeout=30)
    if code != 0:
        return {"installed": False, "version": "", "authenticated": False}
    status_code, status = run(["claude", "auth", "status"], timeout=60)
    authenticated = False
    if status_code == 0:
        try:
            authenticated = bool(json.loads(status).get("loggedIn"))
        except Exception:
            authenticated = False
    if not authenticated:
        # The flow that prints a token rather than writing a credential store
        # leaves it here for the gateway; that is a signed-in runtime too.
        authenticated = os.path.exists(os.path.join(CONFIG_DIR, "claude.env"))
    return {
        "installed": True,
        "version": version.splitlines()[0] if version else "",
        "authenticated": authenticated,
    }


def probe_adapters():
    """What each runtime is, for the settings surface to render.

    Only these four fields are published. Raw CLI output is never mirrored
    here, so nothing a runtime happens to print can leak through the probe.
    """
    adapters = {}
    for name, probe in (("codex", probe_codex), ("claude-code", probe_claude)):
        try:
            answer = probe()
        except Exception:
            answer = {"installed": False, "version": "", "authenticated": False}
        adapters[name] = {
            **answer,
            # Both runtimes bill against the user's own subscription. Nothing
            # here reaches an API-key account.
            "billing": "subscription",
            "state": "ready" if answer["authenticated"] else "unconfigured",
        }
    write_json(ADAPTERS, adapters)
    return adapters


def adopt_codex_tokens():
    """Adopt the Codex CLI's token pair into Hermes's own auth store.

    Hermes's `openai-codex` provider resolves credentials from its own store
    while the device-code login lands them in the CLI's home, so a login that
    is not adopted leaves the agent signed out from Hermes's point of view.
    Hermes's importer refuses an expired access token, so an aged pair is
    refreshed first — and the fresh pair is written to both stores, because
    refresh tokens are single-use and the app-server subprocess reads the
    CLI's file.
    """
    auth_path = os.path.join(HOME, ".codex", "auth.json")
    if not os.path.exists(auth_path):
        return
    try:
        os.environ.setdefault("HERMES_HOME", HOME)
        os.environ.setdefault("HOME", HOME)
        from hermes_cli.auth import (  # type: ignore
            _codex_access_token_is_expiring,
            _recover_codex_tokens_from_cli,
            _save_codex_tokens,
            refresh_codex_oauth_pure,
        )

        if _recover_codex_tokens_from_cli("calliopa login broker"):
            return
        with open(auth_path) as handle:
            payload = json.load(handle)
        tokens = payload.get("tokens") or {}
        access, refresh = tokens.get("access_token"), tokens.get("refresh_token")
        if not access or not refresh:
            return
        if _codex_access_token_is_expiring(access, 0):
            refreshed = refresh_codex_oauth_pure(access, refresh)
            fresh = refreshed.get("tokens") or refreshed
            if fresh.get("access_token") and fresh.get("refresh_token"):
                tokens.update(fresh)
                payload["tokens"] = tokens
                payload["last_refresh"] = refreshed.get("last_refresh") or payload.get(
                    "last_refresh"
                )
                tmp = auth_path + ".tmp"
                with open(tmp, "w") as handle:
                    json.dump(payload, handle)
                os.chmod(tmp, 0o600)
                os.replace(tmp, auth_path)
                _save_codex_tokens(dict(tokens))
    except Exception as error:
        # A failed adoption must never take the broker down with it.
        print(f"codex token adoption failed: {error}", flush=True)


def pump(process, state):
    """Mirror a CLI's output into the state, promoting the URL and user code."""
    for raw in process.stdout:
        line = clean_terminal(raw).rstrip("\n")
        state["output"] = (state["output"] + "\n" + line)[-4000:]
        url = URL_PATTERN.search(line)
        if url and "url" not in state:
            state["url"] = url.group(0).rstrip(".,)")
        code = CODE_PATTERN.search(line)
        if code and "userCode" not in state:
            state["userCode"] = code.group(1)
        write_state(state)


def pump_pty(master_fd, state, secrets):
    """Mirror pty output into the state.

    A TUI redraws heavily, so chunks are cleaned and the patterns search the
    cleaned whole rather than a line. Any long-lived token is captured for the
    gateway and redacted from the mirror in the same pass.
    """
    buffer = ""
    while True:
        try:
            chunk = os.read(master_fd, 4096)
        except OSError:
            break
        if not chunk:
            break
        buffer = (buffer + clean_terminal(chunk.decode("utf-8", "replace")))[-12000:]
        secret = SECRET_PATTERN.search(buffer)
        if secret and not secrets.get("token"):
            secrets["token"] = secret.group(0)
        state["output"] = SECRET_PATTERN.sub("sk-ant-…redacted…", buffer)[-4000:]
        url = URL_PATTERN.search(buffer)
        if url and "url" not in state:
            state["url"] = url.group(0).rstrip(".,)")
        code = CODE_PATTERN.search(buffer)
        if code and "userCode" not in state:
            state["userCode"] = code.group(1)
        write_state(state)


def start_login(runtime):
    """The runtime's own login flow, as a process this broker can follow."""
    if runtime == "codex":
        return ["codex", "login", "--device-auth"], "browser", False
    if runtime == "claude-code":
        # Claude's setup flow is an Ink TUI: it renders nothing without a
        # terminal, so it runs on a pseudo-terminal and the pasted code is
        # written to the pty with a carriage return.
        return ["claude", "setup-token"], "code", True
    return None, None, None


def run_login(runtime):
    command, awaiting, use_pty = start_login(runtime)
    if command is None:
        write_state(
            {
                "runtime": runtime,
                "status": "failed",
                "output": f"There is no {runtime!r} runtime to sign in to.",
            }
        )
        return

    state = {"runtime": runtime, "status": "running", "awaiting": awaiting, "output": ""}
    write_state(state)
    master_fd = None
    secrets = {}
    try:
        if use_pty:
            import fcntl
            import pty
            import struct
            import termios

            master_fd, slave_fd = pty.openpty()
            # A wide window keeps the auth URL on one line; an 80-column wrap
            # splits it into an unusable fragment.
            fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, struct.pack("HHHH", 50, 500, 0, 0))
            env = dict(os.environ, TERM="xterm-256color", COLUMNS="500", LINES="50")
            process = subprocess.Popen(
                command,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                env=env,
                close_fds=True,
            )
            os.close(slave_fd)
            reader = threading.Thread(
                target=pump_pty, args=(master_fd, state, secrets), daemon=True
            )
        else:
            process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            reader = threading.Thread(target=pump, args=(process, state), daemon=True)
    except Exception as error:
        write_state({"runtime": runtime, "status": "failed", "output": str(error)})
        return
    reader.start()

    deadline = time.time() + LOGIN_TIMEOUT_SECONDS
    code_sent = False
    heartbeat = 0.0
    while process.poll() is None and time.time() < deadline:
        # A quiet TUI produces no output, but the state must stay current for
        # the surface watching it.
        if time.time() - heartbeat > 3:
            write_state(state)
            heartbeat = time.time()
        # A new request abandons the one in flight: the human asked again.
        if os.path.exists(REQUEST):
            process.kill()
            state.update({"status": "failed", "awaiting": None})
            state["output"] = (state.get("output") or "") + "\nsuperseded by a new request"
            write_state(state)
            break
        if runtime == "claude-code" and not code_sent and os.path.exists(CODE):
            with open(CODE) as handle:
                pasted = handle.read().strip()
            os.remove(CODE)
            try:
                if master_fd is not None:
                    # Paste, let the field process it, then submit. One
                    # combined write races Ink's input handling.
                    os.write(master_fd, pasted.encode())
                    time.sleep(1.0)
                    os.write(master_fd, b"\r")
                else:
                    process.stdin.write(pasted + "\n")
                    process.stdin.flush()
                code_sent = True
                state["awaiting"] = "cli"
                write_state(state)
            except Exception:
                pass
        time.sleep(1)

    if process.poll() is None:
        process.kill()
        state.update({"status": "failed", "awaiting": None})
        state["output"] = (state.get("output") or "") + "\nthe login timed out"
        write_state(state)
        if master_fd is not None:
            os.close(master_fd)
        return

    reader.join(timeout=5)
    if master_fd is not None:
        try:
            os.close(master_fd)
        except OSError:
            pass

    succeeded = process.returncode == 0
    if succeeded and runtime == "claude-code" and secrets.get("token"):
        # The CLI printed the long-lived token rather than writing its
        # credential store. It is persisted for the gateway to source, with the
        # variable that bills the subscription rather than extra-usage credits,
        # and never mirrored anywhere the surface can read.
        claude_env = os.path.join(CONFIG_DIR, "claude.env")
        with open(claude_env, "w") as handle:
            handle.write("CLAUDE_CODE_OAUTH_TOKEN=" + secrets["token"] + "\n")
        os.chmod(claude_env, 0o600)

    # Adopt, probe, then publish. The surface stops watching the moment this
    # state stops being `running` and re-reads the row, and the row is what the
    # probe last reported — so a success announced before the probe is a success
    # the row cannot yet show, and the human is left reloading to see it. The
    # adoption goes first either way: the probe asks `codex login status`, and
    # the adopted pair is what makes that answer true.
    if succeeded and runtime == "codex":
        adopt_codex_tokens()
    probe_adapters()
    state.update({"status": "succeeded" if succeeded else "failed", "awaiting": None})
    write_state(state)


def main():
    os.makedirs(LOGIN_DIR, exist_ok=True)
    # One broker at a time: a second would race this one for requests and for
    # the pseudo-terminal. The lock is held for the life of the process.
    import fcntl

    lock = open(os.path.join(LOGIN_DIR, ".broker.lock"), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("another login broker holds the lock; exiting", flush=True)
        return

    adopt_codex_tokens()
    for stale in (REQUEST, CODE, STATE):
        try:
            os.remove(stale)
        except FileNotFoundError:
            pass

    probed = 0.0
    while True:
        if os.path.exists(REQUEST):
            try:
                with open(REQUEST) as handle:
                    request = json.load(handle)
            except Exception:
                request = {}
            try:
                os.remove(REQUEST)
            except FileNotFoundError:
                pass
            run_login(str(request.get("runtime", "")))
            probed = time.time()
        elif time.time() - probed > PROBE_INTERVAL_SECONDS:
            probe_adapters()
            probed = time.time()
        time.sleep(2)


if __name__ == "__main__":
    main()
