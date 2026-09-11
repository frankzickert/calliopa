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
RUN chmod +x /usr/local/bin/hermes-entrypoint /usr/local/bin/hermes-login-broker /usr/local/bin/calliopa-claude-runner

EXPOSE 8642 8643

ENTRYPOINT ["/usr/local/bin/hermes-entrypoint"]
