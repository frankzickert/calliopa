#!/usr/bin/env python3
"""The media service's sign-in broker.

Both generators keep their credential inside a vendor CLI, so signing in means running that
CLI's own browser OAuth. The protocol is the agent broker's (`infra/hermes/login_broker.py`,
`BO_0261`): a request file starts a flow, every state of that flow carries the request's id, a
request arriving while a flow is in flight ends that flow as `superseded` before the next
begins, and every ended flow is reaped with its pty reader joined before the descriptor closes.

One thing differs, and it is forced by the vendor rather than chosen. Higgsfield's login waits
for an OAuth redirect on a port inside this container, which the owner's browser cannot reach.
Its own documentation names the recoverable path: leave the listener running, approve in
whatever browser you have, and hand the redirect back from the machine running the CLI. So the
flow publishes the URL, then waits in `awaiting_redirect` until a second request carries the
`code` and `state` the browser landed on, and hands them to the listener itself. BO_0273_004
"""

from __future__ import annotations

import json
import os
import pty
import re
import select
import signal
import subprocess
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

# The flow's two files live on the volume the kernel mounts too, so the served tree writes the
# request and reads the state itself, as it already does for the agent's sign-in. This broker is
# the only thing that runs the CLI; nothing crosses a network to start a login.
CONFIG_DIR = Path(os.environ.get("CALLIOPA_MEDIA_CONFIG_DIR", "/var/lib/calliopa/media-config"))
LOGIN_DIR = CONFIG_DIR / "login"
REQUEST = LOGIN_DIR / "request.json"
STATE = LOGIN_DIR / "state.json"

HIGGSFIELD_BIN = os.environ.get("HIGGSFIELD_BIN", "higgsfield")
OPENART_BIN = os.environ.get("OPENART_BIN", "openart")
CALLBACK_PORT = int(os.environ.get("CALLIOPA_MEDIA_CALLBACK_PORT", "8765"))
LOGIN_TIMEOUT_SECONDS = float(os.environ.get("CALLIOPA_MEDIA_LOGIN_TIMEOUT", "900"))
POLL_SECONDS = float(os.environ.get("CALLIOPA_MEDIA_POLL_SECONDS", "2"))

URL = re.compile(r"https?://[^\s\"'<>]+")
# Higgsfield prints no address at all: it writes a page into the container and
# says to open *that file*. The authorize URL is inside it. BO_0273_034
PAGE = re.compile(r"file://(/[^\s\"'<>]+\.html)")
SERVICES = ("higgsfield", "openart")

_flow: dict[str, object] = {}
_flow_lock = threading.Lock()


_write_lock = threading.Lock()


def write_json(path: Path, value: dict) -> None:
    # The pump thread and the flow both publish, so the temporary name is this
    # writer's alone and the replace is serialized: two threads sharing one
    # temporary file leave the loser replacing a path that is already gone.
    path.parent.mkdir(parents=True, exist_ok=True)
    with _write_lock:
        temporary = path.with_suffix(f"{path.suffix}.{os.getpid()}.{threading.get_ident()}.tmp")
        temporary.write_text(json.dumps(value))
        temporary.replace(path)


def read_json(path: Path) -> dict | None:
    try:
        parsed = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def publish(state: dict) -> None:
    """Every state of a flow carries its request's id, so a row never reads an older flow's."""
    write_json(STATE, state)


def clean(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;?]*[A-Za-z]|\r", "", text)


# --------------------------------------------------------------------------- #
# one flow
# --------------------------------------------------------------------------- #

def url_in(output: str) -> str | None:
    """The address to open, however the vendor chose to give it.

    OpenArt prints the authorize URL. **Higgsfield prints none**: it writes a
    sign-in page into the container and names the file, so the URL is read out
    of that page. Verified against both CLIs on 2026-09-21 (`BO_0273_034`).
    """
    found = URL.search(output)
    if found is not None:
        return found.group(0)
    page = PAGE.search(output)
    if page is None:
        return None
    try:
        written = Path(page.group(1)).read_text(errors="replace")
    except OSError:
        return None
    inside = URL.search(written)
    # The page is HTML, so its href is escaped; the CLI's listener wants the
    # address as it was written, not as it was displayed.
    return None if inside is None else inside.group(0).replace("&amp;", "&")


def callback_of(url: str) -> tuple[int, str] | None:
    """The loopback the CLI is waiting on, read out of the URL it printed.

    Both vendors put their `redirect_uri` in the authorize URL, and **OpenArt
    picks a fresh ephemeral port for every flow** — verified 2026-09-21, it
    printed `http://127.0.0.1:37167/callback` — so the port cannot be published
    in advance and cannot be guessed. Reading it here is what lets the redirect
    be handed back whatever port the CLI chose.
    """
    query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    redirect = (query.get("redirect_uri") or [""])[0]
    if not redirect:
        return None
    parsed = urllib.parse.urlparse(redirect)
    if parsed.port is None:
        return None
    return parsed.port, parsed.path or "/callback"


def argv_for(service: str) -> list[str]:
    if service == "higgsfield":
        return [HIGGSFIELD_BIN, "auth", "login", "--port", str(CALLBACK_PORT)]
    return [OPENART_BIN, "login"]


def hand_back_redirect(code: str, state: str, port: int, path: str) -> tuple[bool, str]:
    """The documented recovery: give the waiting listener the redirect the browser landed on.

    The port is the one the CLI chose, not a port we picked: a browser outside
    this container reaches its own loopback, never ours, so for every vendor
    whose flow ends on a loopback redirect this is the path that works.
    """
    query = urllib.parse.urlencode({"code": code, "state": state})
    url = f"http://127.0.0.1:{port}{path}?{query}"
    try:
        with urllib.request.urlopen(url, timeout=30) as answer:
            answer.read()
        return True, ""
    except Exception as refusal:                                  # noqa: BLE001 — reported, not raised
        return False, f"the listener did not take the redirect: {refusal}"


# A Higgsfield workspace is chosen after signing in, not here: its id is only knowable once the
# login reveals it, so a flow could only ever set one for someone who already knew it. The
# service lists the account's workspaces and takes the one the owner picks. BO_0273_042


def run_login(service: str, request_id: str | None,
              previous: dict | None = None) -> None:
    """Run the CLI under a pty, publish what it says, and end in one terminal state."""
    output: list[str] = []
    published_url = False

    def base(status: str, **rest: object) -> dict:
        state: dict = {"service": service, "status": status, "id": request_id}
        if previous is not None:
            # What this flow replaced. A row following the older flow reads its
            # outcome here however quickly this one publishes over it, which the
            # single state slot otherwise makes unobservable.
            state["previous"] = previous
        state.update(rest)
        return state

    def say(state: dict) -> None:
        # A superseded flow never publishes again: its state would land after
        # the flow that replaced it and the row would follow the older one.
        if superseded.is_set():
            return
        publish(state)

    # Pipes rather than a pty. Higgsfield's CLI prints **nothing** on a
    # terminal — it holds its callback port and waits in silence — and prints
    # what it is doing only when its output is not a tty; OpenArt prints either
    # way. Neither needs a terminal, so neither is given one. BO_0273_034
    try:
        process = subprocess.Popen(argv_for(service), stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   close_fds=True, start_new_session=True)
    except FileNotFoundError:
        publish(base("failed", output=f"the {service} CLI is not installed in this image"))
        return
    master = process.stdout.fileno() if process.stdout is not None else -1

    stop = threading.Event()
    superseded = threading.Event()
    awaiting_said = threading.Event()
    waiting_on: dict[str, object] = {}

    def pump() -> None:
        nonlocal published_url
        while not stop.is_set():
            try:
                ready, _, _ = select.select([master], [], [], 0.5)
            except OSError:
                return
            if not ready:
                continue
            try:
                chunk = os.read(master, 4096)
            except OSError:
                return
            if not chunk:
                return
            text = clean(chunk.decode(errors="replace"))
            output.append(text)
            # The address and the loopback are looked for separately, and the
            # loopback is looked for again on every chunk until it is known: a
            # pipe splits a line where it likes, and a URL matched half-read
            # once set "found" for good with no callback in it, so the flow
            # published an address and then waited for a port it never had.
            if not published_url:
                found_url = url_in("".join(output))
                if found_url is not None:
                    published_url = True
                    say(base("running", url=found_url, output="".join(output)[-4000:]))
            if "port" not in waiting_on:
                whole = url_in("".join(output))
                listener = None if whole is None else callback_of(whole)
                if listener is not None:
                    waiting_on["port"], waiting_on["path"] = listener

    reader = threading.Thread(target=pump, daemon=True)
    reader.start()
    with _flow_lock:
        _flow.update({"process": process, "reader": reader, "stop": stop, "master": master,
                      "superseded": superseded, "id": request_id, "service": service})

    say(base("running", output=""))
    deadline = time.monotonic() + LOGIN_TIMEOUT_SECONDS
    while process.poll() is None and time.monotonic() < deadline:
        if superseded.is_set():
            break
        if published_url and "port" in waiting_on:
            held = read_json(REQUEST) or {}
            if held.get("id") == request_id and held.get("code") and held.get("state"):
                handed, reason = hand_back_redirect(
                    str(held["code"]), str(held["state"]),
                    int(waiting_on["port"]), str(waiting_on["path"]),
                )
                if not handed:
                    end(process, stop, reader, master)
                    say(base("failed", output=reason))
                    return
            elif not held.get("code") and not awaiting_said.is_set():
                # Once. Republishing it would overwrite whatever came after.
                awaiting_said.set()
                found = url_in("".join(output))
                say(base("awaiting_redirect", url=found if found is not None else "",
                         callbackPort=int(waiting_on["port"]), output="".join(output)[-4000:]))
        time.sleep(0.5)

    timed_out = process.poll() is None
    end(process, stop, reader, master)
    if superseded.is_set():
        return                                                     # a supersession publishes its own
    if timed_out:
        say(base("failed", output="the login timed out"))
        return
    if process.returncode != 0:
        say(base("failed", output="".join(output)[-4000:]))
        return
    say(base("succeeded", output="".join(output)[-4000:]))


def end(process: subprocess.Popen, stop: threading.Event, reader: threading.Thread,
        master: int) -> None:                                      # noqa: ARG001 — kept for the call shape
    """Reap before anything else looks: a process not yet reaped reads as still running."""
    stop.set()
    if process.poll() is None:
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    reader.join(timeout=5)                                         # before the descriptor closes
    # Close the pipe through the object that owns it. Closing the raw
    # descriptor left Popen holding a number the kernel could hand to the next
    # flow, and the next close took *its* pipe: the flow after a supersession
    # then read nothing at all.
    if process.stdout is not None:
        try:
            process.stdout.close()
        except OSError:
            pass


def supersede() -> dict | None:
    """End the flow in flight under its own id, before the next one publishes anything.

    Answers what it ended, so the flow that replaces it carries that outcome: the state slot
    holds one flow, and a superseded state published here is overwritten by the next flow's
    first state a millisecond later, which no reader can be expected to catch.
    """
    with _flow_lock:
        held = dict(_flow)
        _flow.clear()
    process = held.get("process")
    if process is None:
        return None
    held["superseded"].set()                                       # type: ignore[union-attr]
    end(process, held["stop"], held["reader"], held["master"])     # type: ignore[arg-type]
    ended = {"id": held.get("id"), "status": "superseded", "service": held.get("service")}
    publish({**ended, "output": "another sign-in started"})
    return ended


# --------------------------------------------------------------------------- #
# the loop
# --------------------------------------------------------------------------- #

def main() -> int:
    LOGIN_DIR.mkdir(parents=True, exist_ok=True)
    handled: str | None = None
    while True:
        request = read_json(REQUEST)
        if request is not None:
            identity = str(request.get("id") or "")
            service = str(request.get("service") or "")
            redirect = bool(request.get("code"))
            if service in SERVICES and identity and identity != handled and not redirect:
                handled = identity
                ended = supersede()
                # In a thread: a flow that blocked this loop could not be
                # superseded while it was in flight, which is the one thing
                # supersession is for.
                threading.Thread(
                    target=run_login,
                    args=(service, identity, ended),
                    daemon=True,
                ).start()
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
