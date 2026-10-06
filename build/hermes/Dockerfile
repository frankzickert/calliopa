# The Hermes agent service, built on your machine from this recipe: the base
# image is pulled by you from Docker Hub, the pinned upstream Hermes release
# is pip-installed by you, and the two subscription CLIs are npm-installed by
# you under your own entitlements. Calliopa publishes no Hermes image and
# redistributes none of these; only the entrypoint and the sign-in broker
# beside this file are Calliopa's. The pin-bump assertions below are what
# keep a moved upstream from silently disabling the patch. BO_0211_001
#
# This recipe is the dogfood stack's infra/hermes/Dockerfile with the bases
# pinned by digest; the release script keeps the two in step.
FROM python:3.13-slim@sha256:7ce4b6dfe35e55397b7cda544f8a13f191b7ae28dc5aad71fe664dbc9bc2623f

# The pin is a pin, not `latest`. The two extra dependencies are what the base
# install misses: without `aiohttp` the API server reports "no adapter
# available" and serves nothing, and the mcp 2.0 SDK drops the legacy symbol
# the release's HTTP-transport gate probes for, which disables HTTP MCP
# entirely rather than failing loudly.
RUN pip install --no-cache-dir \
    hermes-agent==0.19.0 \
    aiohttp \
    "mcp>=1.24,<2"

# Node comes from the official image rather than from Debian, whose `nodejs` is
# still 20 on this base while both CLIs below declare `node >=22`. Installing
# them on 20 succeeds with an `EBADENGINE` warning and leaves an unsupported
# runtime to be discovered at the first real delegation. The tag matches the
# python base's Debian release, so there is one libc in the image.
COPY --from=node:22-trixie-slim@sha256:7b8a0c89c54499bee567618f96578e1a12a800f062fbdbfd1fb6a443fa6f6284 /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-trixie-slim@sha256:7b8a0c89c54499bee567618f96578e1a12a800f062fbdbfd1fb6a443fa6f6284 /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

# The subscription coding runtimes, and the search tool they expect to find.
# Their credential homes live on the data volume rather than in the image, so
# signing in survives a rebuild. Claude Code is pinned: the Claude runner
# passes it flags verified against this version (`--tools`,
# `--permission-mode dontAsk`, `--strict-mcp-config`,
# `--append-system-prompt-file`, `${VAR}` expansion in `--mcp-config`
# headers), so a bump is re-verified the way the patches below are.
# BO_0228_001
RUN apt-get update \
    && apt-get install -y --no-install-recommends ripgrep \
    && npm install -g @anthropic-ai/claude-code@2.1.251 @openai/codex \
    && npm cache clean --force \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pinned-release patch. In codex app-server mode the release auto-accepts MCP
# elicitations only for its own injected `hermes-tools` server and declines
# every other one — including the toolset this stack explicitly configured.
#
# The assertion is the point: a pin bump that moves this code fails the build
# loudly, so the patch is re-evaluated rather than silently becoming a no-op.
RUN python3 - <<'EOF'
import pathlib

path = pathlib.Path(
    "/usr/local/lib/python3.13/site-packages/agent/transports/codex_app_server_session.py"
)
source = path.read_text()
old = 'if server_name == "hermes-tools":'
assert old in source, (
    "hermes pin changed: the calliopa elicitation-acceptance patch no longer "
    "applies. Re-evaluate it against the new release before bumping the pin."
)
# Two Calliopa toolsets: the shell's own MCP surface and the kernel's code
# toolset, registered under distinct server names. BO_0200_008
patched = source.replace(old, 'if server_name in {"hermes-tools", "calliopa", "calliopa-kernel"}:')
assert '"calliopa-kernel"' in patched
path.write_text(patched)
EOF

# Pinned-release patch. In codex app-server mode the release never forwards a
# run's instructions: `/v1/runs` takes them as the agent's ephemeral system
# prompt, which only Hermes's own loop applies, and that loop is bypassed for
# this runtime — `thread/start` carries the working directory alone and
# `turn/start` the reader's text alone. Every run the kernel bridge started on
# codex therefore went out without its contract: the document it was aimed at,
# where its work goes, the pin and group, the skills. Codex's `thread/start`
# takes `developerInstructions`; the session now sends the run's instructions
# there. One agent, one Codex session and one thread are built per run, so the
# instructions a thread starts with are that run's. BO_0226_011
#
# The assertions are the point, as above: a pin bump that moves any of the
# three places fails the build rather than quietly dropping the contract again.
RUN python3 - <<'EOF'
import pathlib

root = pathlib.Path("/usr/local/lib/python3.13/site-packages/agent")


def patch(relative, old, new):
    path = root / relative
    source = path.read_text()
    assert source.count(old) == 1, (
        f"hermes pin changed: the calliopa developer-instructions patch no longer "
        f"applies to {relative}. Re-evaluate it against the new release before "
        f"bumping the pin."
    )
    path.write_text(source.replace(old, new))


patch(
    "transports/codex_app_server_session.py",
    "        client_factory: Optional[Callable[..., CodexAppServerClient]] = None,\n"
    "    ) -> None:\n"
    "        self._cwd = cwd or os.getcwd()\n",
    "        client_factory: Optional[Callable[..., CodexAppServerClient]] = None,\n"
    "        developer_instructions: Optional[str] = None,\n"
    "    ) -> None:\n"
    "        self._cwd = cwd or os.getcwd()\n"
    "        self._developer_instructions = developer_instructions\n",
)
patch(
    "transports/codex_app_server_session.py",
    '        params: dict[str, Any] = {"cwd": self._cwd}\n',
    '        params: dict[str, Any] = {"cwd": self._cwd}\n'
    "        if self._developer_instructions:\n"
    '            params["developerInstructions"] = self._developer_instructions\n',
)
patch(
    "codex_runtime.py",
    "        agent._codex_session = CodexAppServerSession(\n"
    "            cwd=cwd,\n",
    "        agent._codex_session = CodexAppServerSession(\n"
    "            cwd=cwd,\n"
    '            developer_instructions=getattr(agent, "ephemeral_system_prompt", None) or None,\n',
)
EOF

# Pinned-release patches for runs side by side. BO_0269_007 BO_0269_008
# BO_0269_009 BO_0269_011
#
# Each run names itself on its tool calls, so the kernel binds a call to that
# run's context while other runs are going. The kernel sets every gateway
# run's session to its own run id. Hermes's own loop hands each tool handler
# the agent's session id, and the handler's call now carries it as the MCP
# request's `_meta`. A Codex run is its own `codex app-server` process; it is
# spawned with CALLIOPA_RUN_ID in its environment, which the toolset's
# registration sends as the X-Calliopa-Run header (`env_http_headers`, written
# by the entrypoint).
#
# Codex and Hermes share one gateway. A run names its controller and speed by
# model route; a route may now carry `api_mode` and `reasoning_effort` beside
# the model and provider it always could, so no run rewrites the gateway's
# configuration or restarts it. The Codex session takes the route's model and
# effort on `thread/start`.
#
# The assertions are the point, as above.
RUN python3 - <<'EOF'
import pathlib

root = pathlib.Path("/usr/local/lib/python3.13/site-packages")


def patch(relative, old, new):
    path = root / relative
    source = path.read_text()
    assert source.count(old) == 1, (
        f"hermes pin changed: the calliopa concurrent-runs patch no longer "
        f"applies to {relative}. Re-evaluate it against the new release before "
        f"bumping the pin."
    )
    path.write_text(source.replace(old, new))


patch(
    "tools/mcp_tool.py",
    "                    result = await server.session.call_tool(tool_name, arguments=args)\n",
    "                    result = await server.session.call_tool(\n"
    "                        tool_name,\n"
    "                        arguments=args,\n"
    "                        meta=(\n"
    '                            {"calliopa/run": kwargs["session_id"]}\n'
    '                            if server_name == "calliopa-kernel" and kwargs.get("session_id")\n'
    "                            else None\n"
    "                        ),\n"
    "                    )\n",
)
patch(
    "gateway/platforms/api_server.py",
    '        allowed_keys = ("model", "provider", "api_key", "base_url")\n',
    '        allowed_keys = ("model", "provider", "api_key", "base_url", "api_mode", "reasoning_effort")\n',
)
patch(
    "gateway/platforms/api_server.py",
    '            if route.get("base_url"):\n'
    '                runtime_kwargs["base_url"] = route["base_url"]\n',
    '            if route.get("base_url"):\n'
    '                runtime_kwargs["base_url"] = route["base_url"]\n'
    '            if route.get("api_mode"):\n'
    '                runtime_kwargs["api_mode"] = route["api_mode"]\n'
    '            if route.get("reasoning_effort"):\n'
    "                from hermes_constants import parse_reasoning_effort\n"
    '                reasoning_config = parse_reasoning_effort(route["reasoning_effort"]) or reasoning_config\n',
)
patch(
    "agent/transports/codex_app_server_session.py",
    "        developer_instructions: Optional[str] = None,\n"
    "    ) -> None:\n",
    "        developer_instructions: Optional[str] = None,\n"
    "        thread_overrides: Optional[dict] = None,\n"
    "    ) -> None:\n"
    "        self._thread_overrides = dict(thread_overrides or {})\n",
)
patch(
    "agent/transports/codex_app_server_session.py",
    "        if self._developer_instructions:\n"
    '            params["developerInstructions"] = self._developer_instructions\n',
    "        if self._developer_instructions:\n"
    '            params["developerInstructions"] = self._developer_instructions\n'
    "        params.update(self._thread_overrides)\n",
)
patch(
    "agent/codex_runtime.py",
    "            request_routing=_ServerRequestRouting(\n",
    "            client_factory=_calliopa_client_factory(agent),\n"
    "            thread_overrides=_calliopa_thread_overrides(agent),\n"
    "            request_routing=_ServerRequestRouting(\n",
)
path = root / "agent/codex_runtime.py"
path.write_text(
    path.read_text()
    + '''


def _calliopa_client_factory(agent):
    """The app-server client of one run, spawned with the run's id in its
    environment so its tool calls name the run. BO_0269_008"""
    import functools

    from agent.transports.codex_app_server import CodexAppServerClient

    run = str(getattr(agent, "session_id", "") or "")
    return functools.partial(CodexAppServerClient, env={"CALLIOPA_RUN_ID": run} if run else None)


def _calliopa_thread_overrides(agent):
    """The run's model and reasoning effort, from its route. BO_0269_011"""
    overrides = {}
    model = str(getattr(agent, "model", "") or "")
    if model:
        overrides["model"] = model
    reasoning = getattr(agent, "reasoning_config", None)
    if isinstance(reasoning, dict) and reasoning.get("effort"):
        overrides["config"] = {"model_reasoning_effort": reasoning["effort"]}
    return overrides
'''
)
EOF

# A run's `codex app-server` ends with the run. The pinned release makes an
# agent per gateway run, spawns the agent's app-server on its first Codex turn,
# and drops the agent when the run ends without closing it — and the agent's
# own close never reaches the session — so every Codex run left its
# app-server (the launcher and its binary, ~500 MB together) running until the
# container stopped. The run's executor thread now closes the session when
# `run_conversation` returns, completed, failed or cancelled alike, so nothing
# of a run outlives it and the event loop never waits on the close. The
# assertion is the point, as above. BO_0353_005
RUN python3 - <<'EOF'
import pathlib

root = pathlib.Path("/usr/local/lib/python3.13/site-packages")
path = root / "gateway/platforms/api_server.py"
source = path.read_text()
old = (
    "                            r = agent.run_conversation(\n"
    "                                user_message=user_message,\n"
    "                                conversation_history=conversation_history,\n"
    "                                task_id=effective_task_id,\n"
    "                            )\n"
    "                        finally:\n"
)
assert source.count(old) == 1 and source.count("\nlogger = ") == 1, (
    "hermes pin changed: the calliopa app-server patch no longer applies to "
    "gateway/platforms/api_server.py. Re-evaluate it against the new release "
    "before bumping the pin."
)
source = source.replace(old, old + "                            _calliopa_end_codex_session(agent)\n")
path.write_text(
    source
    + '''


def _calliopa_end_codex_session(agent):
    """The run's codex app-server, ended with the run. BO_0353_005"""
    session = getattr(agent, "_codex_session", None)
    if session is None:
        return
    agent._codex_session = None
    try:
        session.close()
    except Exception:
        logger.warning("codex app-server of a finished run did not close", exc_info=True)
'''
)
EOF

# A run cut off by the memory limit says so. The service runs under
# CALLIOPA_HERMES_MEMORY, and the kernel's OOM killer takes the largest process
# when it is reached — a run's app-server. The release already ends the turn
# at once when its app-server dies; its words now name the limit when the
# container's OOM count rose since that app-server started (cgroup v2's
# memory.events, v1's memory.oom_control). The assertions are the point, as
# above. BO_0353_007
RUN python3 - <<'EOF'
import pathlib

root = pathlib.Path("/usr/local/lib/python3.13/site-packages/agent/transports")


def patch(relative, old, new, count=1):
    path = root / relative
    source = path.read_text()
    assert source.count(old) == count, (
        f"hermes pin changed: the calliopa memory-limit patch no longer applies to "
        f"{relative}. Re-evaluate it against the new release before bumping the pin."
    )
    path.write_text(source.replace(old, new))


patch(
    "codex_app_server.py",
    "        self._closed = False\n",
    "        self._closed = False\n"
    "        self._calliopa_oom_base = calliopa_oom_kills()\n",
)
patch(
    "codex_app_server.py",
    "\nimport os\n",
    "\nimport os\n"
    "\n\n"
    "def calliopa_oom_kills():\n"
    '    """The container\'s OOM kills so far, or None where the cgroup does not say. BO_0353_007"""\n'
    '    for path in ("/sys/fs/cgroup/memory.events", "/sys/fs/cgroup/memory/memory.oom_control"):\n'
    "        try:\n"
    "            for line in open(path):\n"
    '                if line.startswith("oom_kill "):\n'
    "                    return int(line.split()[1])\n"
    "        except (OSError, ValueError):\n"
    "            continue\n"
    "    return None\n"
    "\n\n",
)
patch(
    "codex_app_server_session.py",
    '                        "codex app-server subprocess exited unexpectedly",\n',
    "                        _calliopa_exit_words(self._client),\n",
    count=2,
)
path = root / "codex_app_server_session.py"
path.write_text(
    path.read_text()
    + '''


def _calliopa_exit_words(client):
    """Why the app-server is gone: the memory limit when the OOM killer took it. BO_0353_007"""
    from agent.transports.codex_app_server import calliopa_oom_kills

    base = getattr(client, "_calliopa_oom_base", None)
    now = calliopa_oom_kills()
    if base is not None and now is not None and now > base:
        return (
            "the run was stopped because the agent service reached its memory limit "
            "(CALLIOPA_HERMES_MEMORY in .env); raise it and run ./install.sh again"
        )
    return "codex app-server subprocess exited unexpectedly"
'''
)
EOF

# Both trap dependencies, asserted at build time so a broken image never
# reaches a compose file. `aiohttp` is what the API server needs an adapter
# from; `mcp.client.streamable_http` is the module the release's transport gate
# probes for and the 2.0 line moved.
RUN python3 -c "import aiohttp, mcp.client.streamable_http" \
    && python3 -c "import importlib.metadata as m; v = m.version('mcp'); assert v.split('.')[0] == '1', f'mcp {v} is not on the 1.x line HTTP MCP needs'" \
    && node --version | grep -Eq '^v(2[2-9]|[3-9][0-9])\.' 

# The config, the .env and the SessionDB all relocate onto the named volume, so
# a rebuild keeps the agent's identity and its sessions.
ENV HERMES_HOME=/var/lib/hermes
VOLUME /var/lib/hermes

# The API server is off unless it is told otherwise, and refuses a key shorter
# than 16 characters. The key itself arrives at run time; nothing here bakes
# one in, because a baked credential cannot be rotated.
ENV API_SERVER_ENABLED=true \
    API_SERVER_HOST=0.0.0.0 \
    API_SERVER_PORT=8642

# The entrypoint assembles what the image deliberately does not carry: the
# API-server .env, the agent's credential, and the runtime configuration. It is
# copied rather than baked into a layer of its own so editing it is a rebuild
# of one step. CA_0022_005 BO_0200_007
COPY entrypoint.sh /usr/local/bin/hermes-entrypoint
COPY login_broker.py /usr/local/bin/hermes-login-broker
COPY claude_runner.py /usr/local/bin/calliopa-claude-runner
COPY codex_image_runner.py /usr/local/bin/calliopa-codex-image-runner
# Hermes in the background: what to prepare and how to arrange it. BO_0350_060
COPY orchestrator.py /usr/local/bin/calliopa-orchestrator
RUN chmod +x /usr/local/bin/hermes-entrypoint /usr/local/bin/hermes-login-broker /usr/local/bin/calliopa-claude-runner /usr/local/bin/calliopa-codex-image-runner /usr/local/bin/calliopa-orchestrator

EXPOSE 8642 8643 8644 8645

ENTRYPOINT ["/usr/local/bin/hermes-entrypoint"]
