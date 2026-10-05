#!/usr/bin/env python3
"""Hermes in the background: what to prepare and how to arrange it.

Hermes takes no command (BO_0350). The kernel hands it each person's acts once
they rest, with the documents they concern, and Hermes answers what the
working agents should prepare and how that person's work is arranged; the
kernel carries the answer out. Hermes writes no content and stages nothing:
it answers JSON, which this process checks against what it was shown before
the kernel sees it. BO_0350_060

What Hermes learns of a person is kept in Honcho, one peer per person: each
batch of acts is added to the person's session, and what Honcho concluded is
read before Hermes decides. The person reads and erases those conclusions
through the kernel. With no Honcho configured Hermes decides from the acts
alone and says the memory is off. BO_0350_061 BO_0350_062

  POST   /v1/orchestrate          {person, acts, documents} -> {prepare, withdraw, arrangement, forward}
  GET    /v1/learned?person=      {memory, learned: [{id, words, at}]}
  DELETE /v1/learned/{id}?person=
  GET    /health

Every route but health answers under the gateway's API bearer.
"""

import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERMES_HOME = os.environ.get("HERMES_HOME", "/var/lib/hermes")
HOST = os.environ.get("CALLIOPA_ORCHESTRATOR_HOST", "0.0.0.0")
PORT = int(os.environ.get("CALLIOPA_ORCHESTRATOR_PORT", "8645"))
GATEWAY_URL = os.environ.get("CALLIOPA_GATEWAY_URL", "http://127.0.0.1:8642").rstrip("/")
# The gateway route Hermes's own loop reasons on, at the fast speed.
# BO_0269_009
MODEL = os.environ.get("CALLIOPA_ORCHESTRATOR_MODEL", "calliopa-hermes-fast")
HONCHO_URL = os.environ.get("HONCHO_BASE_URL", "").rstrip("/")
WORKSPACE = os.environ.get("CALLIOPA_HONCHO_WORKSPACE", "calliopa")
TIMEOUT_SECONDS = 90

# What the kernel accepts: the working agents, the two pinches, one screen of
# cards, and a few preparations at a time.
AGENTS = ("codex", "claude-code")
PINCHES = ("in", "out")
MAX_CARDS = 7
MAX_PREPARE = 3

INSTRUCTIONS = """You are Hermes, the assistant working in the background of Calliopa.
A person decides on cards — proposals the working agents made — by gesture: a
right swipe keeps a card, a left swipe dismisses it, a pinch in deepens a block
or a card of one proposal, a pinch out gathers a block's neighbours, and a drag
aside keeps a card for later. You never write content and never answer a card.

From the person's latest acts, the documents they concern and what you know of
how they work, decide:
- prepare: the pinches the person is likely to make next, so their result is
  ready before they ask. At most three. Each names an artifact and a block of
  it, the pinch "in" or "out", and the agent ("codex" or "claude-code") and
  speed ("fast" or "thorough") to run it. To deepen a card of one proposal,
  name its group, item and revision as the document lists them, with "in".
- withdraw: the ids of runs you prepared earlier and no longer expect.
- arrangement: for the document the person is working in, the cards to draw,
  at most seven, the most worth deciding first; the blocks to collapse (settled,
  far from the work) and the blocks to dim. Never more than the document holds.
- forward: the documents to put forward to the person, if any.

Answer with one JSON object and nothing else:
{"prepare": [...], "withdraw": [...], "arrangement": {"artifact": "...", "cards": [...], "collapsed": [...], "dimmed": [...]}, "forward": [...]}
Prepare nothing rather than guess. Do not call any tool."""


def api_key():
    """The gateway's API bearer, which this process answers under too."""
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


def peer_of(person):
    """A person's Honcho peer, named by a hash so a name reaches no id."""
    return "p-" + hashlib.sha256(person.encode("utf-8")).hexdigest()[:24]


def call(url, method="GET", body=None, headers=None, timeout=TIMEOUT_SECONDS):
    """One JSON request; the parsed answer, or None for an empty one."""
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    for name, value in (headers or {}).items():
        request.add_header(name, value)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
    return json.loads(payload) if payload else None


class Memory:
    """A person's memory in Honcho: one peer, one session of their acts."""

    def __init__(self, base=HONCHO_URL, workspace=WORKSPACE):
        self.base = base
        self.workspace = workspace

    @property
    def on(self):
        return self.base != ""

    def _path(self, *parts):
        return "%s/v3/workspaces/%s%s" % (self.base, urllib.parse.quote(self.workspace), "".join(parts))

    def _ready(self, peer):
        call("%s/v3/workspaces" % self.base, "POST", {"id": self.workspace})
        call(self._path("/peers"), "POST", {"id": peer})
        call(self._path("/sessions"), "POST", {"id": "acts-" + peer, "peers": {peer: {}}})

    def remember(self, person, acts):
        """Adds a batch of acts to the person's session."""
        if not self.on or not acts:
            return
        peer = peer_of(person)
        self._ready(peer)
        messages = [{"content": describe(act), "peer_id": peer} for act in acts]
        call(self._path("/sessions/", "acts-" + peer, "/messages"), "POST", {"messages": messages})

    def known(self, person):
        """What Honcho has concluded about the person, as words, or ""."""
        if not self.on:
            return ""
        peer = peer_of(person)
        try:
            answer = call(self._path("/peers/", peer, "/representation"), "POST", {"max_conclusions": 20})
        except (urllib.error.URLError, OSError, ValueError):
            return ""
        if isinstance(answer, dict):
            return str(answer.get("representation") or answer.get("content") or "")
        return str(answer or "")

    def learned(self, person):
        """Every conclusion Honcho holds about the person, newest first."""
        if not self.on:
            return []
        peer = peer_of(person)
        answer = call(self._path("/conclusions/list?reverse=true&size=100"), "POST", {"filters": {"observed_id": peer}})
        items = answer.get("items", []) if isinstance(answer, dict) else (answer or [])
        return [
            {"id": item.get("id"), "words": item.get("content", ""), "at": item.get("created_at", "")}
            for item in items
            if item.get("observed_id") == peer
        ]

    def forget(self, person, conclusion):
        """Erases one conclusion, when it is about the person; True when it was."""
        if not self.on:
            return False
        if conclusion not in {item["id"] for item in self.learned(person)}:
            return False
        call(self._path("/conclusions/", urllib.parse.quote(conclusion)), "DELETE")
        return True


def describe(act):
    """One act as a line a person's memory can learn from."""
    kind = act.get("kind", "")
    where = " in %s" % act["artifact"] if act.get("artifact") else ""
    blocks = " on %s" % ", ".join(act["blocks"]) if act.get("blocks") else ""
    if kind == "answer":
        return "%s a card%s (group %s)" % (act.get("answer", "answered").capitalize(), where, act.get("group", ""))
    if kind == "defer":
        return "Kept a card for later%s (group %s)" % (where, act.get("group", ""))
    if kind == "undefer":
        return "Took a card back%s (group %s)" % (where, act.get("group", ""))
    if kind == "pinch":
        return "Pinched %s%s%s" % (act.get("pinch", ""), blocks, where)
    if kind == "command":
        return "Asked: %s%s" % (act.get("words", ""), where)
    if kind == "title":
        return "Named the work%s: %s" % (where, act.get("words", ""))
    return json.dumps(act)


def ask_hermes(person, acts, documents, known, key):
    """Hermes's own loop, with the person as its memory key; its text."""
    prompt = {"acts": acts, "documents": documents, "what_you_know_of_this_person": known or "nothing yet"}
    answer = call(
        GATEWAY_URL + "/v1/chat/completions",
        "POST",
        {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": INSTRUCTIONS},
                {"role": "user", "content": json.dumps(prompt)},
            ],
        },
        {"Authorization": "Bearer " + key, "X-Hermes-Session-Key": "orchestrate-" + peer_of(person)},
    )
    choices = (answer or {}).get("choices") or [{}]
    return ((choices[0].get("message") or {}).get("content")) or ""


def parse(text):
    """The JSON object in Hermes's answer, or {}."""
    match = re.search(r"\{.*\}", text or "", re.S)
    if match is None:
        return {}
    try:
        value = json.loads(match.group(0))
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def checked(answer, documents):
    """Hermes's answer, keeping only what names what it was shown."""
    blocks = {doc.get("artifact"): {block.get("id") for block in doc.get("blocks", [])} for doc in documents}
    cards = {doc.get("artifact"): {card.get("group") for card in doc.get("cards", [])} for doc in documents}
    out = {"prepare": [], "withdraw": [], "arrangement": None, "forward": []}
    for ask in answer.get("prepare") or []:
        if len(out["prepare"]) == MAX_PREPARE:
            break
        if not isinstance(ask, dict):
            continue
        artifact, block = ask.get("artifact"), ask.get("block")
        if block not in blocks.get(artifact, set()) or ask.get("pinch") not in PINCHES:
            continue
        if ask.get("agent") not in AGENTS:
            continue
        kept = {key: ask[key] for key in ("artifact", "block", "pinch", "agent") if key in ask}
        kept["speed"] = ask.get("speed") if ask.get("speed") in ("fast", "thorough") else "fast"
        if ask.get("item"):
            if ask.get("pinch") != "in" or ask.get("group") not in cards.get(artifact, set()) or not ask.get("revision"):
                continue
            kept.update(group=ask["group"], item=ask["item"], revision=ask["revision"])
        out["prepare"].append(kept)
    out["withdraw"] = [run for run in (answer.get("withdraw") or []) if isinstance(run, str)]
    arrangement = answer.get("arrangement")
    if isinstance(arrangement, dict) and arrangement.get("artifact") in blocks:
        artifact = arrangement["artifact"]
        out["arrangement"] = {
            "artifact": artifact,
            "cards": [card for card in (arrangement.get("cards") or []) if card in cards.get(artifact, set())][:MAX_CARDS],
            "collapsed": [block for block in (arrangement.get("collapsed") or []) if block in blocks[artifact]],
            "dimmed": [block for block in (arrangement.get("dimmed") or []) if block in blocks[artifact]],
        }
    known = set(blocks)
    out["forward"] = [doc for doc in (answer.get("forward") or []) if doc in known]
    return out


def orchestrate(body, memory, key):
    person = str(body.get("person") or "").strip()
    acts = body.get("acts") or []
    documents = body.get("documents") or []
    if not person or not isinstance(acts, list):
        raise ValueError("an orchestration names a person and their acts")
    try:
        memory.remember(person, acts)
    except (urllib.error.URLError, OSError, ValueError):
        pass
    text = ask_hermes(person, acts, documents, memory.known(person), key)
    return checked(parse(text), documents)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    memory = Memory()

    def log_message(self, fmt, *args):
        pass

    def reply(self, status, body=None):
        payload = b"" if body is None else json.dumps(body).encode("utf-8")
        self.send_response(status)
        if body is not None:
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        if self.close_connection:
            self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(payload)

    def authorized(self):
        key = api_key()
        if key and self.headers.get("Authorization", "") == "Bearer " + key:
            return key
        self.close_connection = True
        self.reply(401, {"error": "unauthorized"})
        return None

    def person(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return (query.get("person") or [""])[0].strip()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/health":
            self.reply(200, {"status": "ok", "memory": "on" if self.memory.on else "off"})
            return
        if not self.authorized():
            return
        if path == "/v1/learned":
            person = self.person()
            if not person:
                self.reply(400, {"error": "name the person"})
                return
            try:
                learned = self.memory.learned(person)
            except (urllib.error.URLError, OSError, ValueError) as error:
                self.reply(502, {"error": "Honcho: %s" % error})
                return
            self.reply(200, {"memory": "on" if self.memory.on else "off", "learned": learned})
            return
        self.reply(404, {"error": "not found"})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        key = self.authorized()
        if not key:
            return
        if path != "/v1/orchestrate":
            self.reply(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}") if length > 0 else {}
            self.reply(200, orchestrate(body, self.memory, key))
        except ValueError as error:
            self.reply(400, {"error": str(error)})
        except (urllib.error.URLError, OSError) as error:
            self.reply(502, {"error": "Hermes did not answer: %s" % error})

    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path
        if not self.authorized():
            return
        prefix = "/v1/learned/"
        person = self.person()
        if not path.startswith(prefix) or not person:
            self.reply(404, {"error": "not found"})
            return
        conclusion = urllib.parse.unquote(path[len(prefix):])
        try:
            forgotten = self.memory.forget(person, conclusion)
        except (urllib.error.URLError, OSError, ValueError) as error:
            self.reply(502, {"error": "Honcho: %s" % error})
            return
        self.reply(204 if forgotten else 404, None if forgotten else {"error": "no such conclusion about this person"})


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print("orchestrator listening on %s:%d (memory %s)" % (HOST, PORT, "on" if HONCHO_URL else "off"), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
