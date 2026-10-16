# Commands

Every command writes one JSON answer on standard output and exits 0, or writes
`{"errors": [...]}` and exits 1 ([errors](spec.md#errors)).

| Command | Answer |
| --- | --- |
| `calliopa list` | `{"modules": [{name, version, summary, source}]}` |
| `calliopa describe <module>` | the module's declaration: name, version, engine, summary, when_to_use, roles, params, sha256, source |
| `calliopa validate <spec.json>` | `{"ok": true}`, or the spec's errors, without rendering |
| `calliopa render <spec.json> -o <out.mp4>` | `{video, tracks, sidecar, frames, pass_frame, fps, width, height}` ([outputs](outputs.md)) |
| `calliopa mcp` | serves the [MCP tools](mcp.md) over standard input and output |
| `calliopa agent install claude\|codex` | registers `calliopa mcp` with the agent and installs its skill |
| `calliopa agent remove claude\|codex` | undoes both |

`--module-path <dir>` lets `list`, `describe`, `validate`, `render` and `mcp` load modules
from a directory first, for authoring a module.

`render` needs ffmpeg on your `PATH`; without it, it says how to install it and stops
before any work.

`agent install` runs the agent's own command (`claude mcp add` or `codex mcp add`) with
calliopa's full path, so the agent finds calliopa without your shell's `PATH`. It never
edits the agent's configuration files itself. The skill goes to
`~/.claude/skills/calliopa/SKILL.md` or `~/.codex/skills/calliopa/SKILL.md`
(`CLAUDE_CONFIG_DIR` and `CODEX_HOME` move them).
