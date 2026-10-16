# calliopa

calliopa renders previs of spaceship shots on your computer: a short video of the
movement, the reference a video model takes, with the camera and the ship per frame
beside it. It is made for AI agents such as Claude Code and Codex, which drive it through
its MCP server or its JSON command line.

This repository holds calliopa's installers, its documentation and its licence. The
binaries are attached to its [releases](https://github.com/frankzickert/calliopa/releases).

## Install

Linux and macOS:

```sh
curl -fsSL https://raw.githubusercontent.com/frankzickert/calliopa/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/frankzickert/calliopa/main/install.ps1 | iex
```

Each installer is pinned to one release. It checks the release's `SHA256SUMS` against the
digest it carries, and the binary against `SHA256SUMS`, and installs nothing on a mismatch.

calliopa runs on Linux (amd64, arm64, WSL included), macOS (Apple Silicon, Intel) and
Windows (amd64). It installs to `~/.local/bin` on Linux and macOS, and to
`%LOCALAPPDATA%\Programs\calliopa` on Windows; `CALLIOPA_INSTALL_DIR` chooses another
directory. Rendering needs [ffmpeg](https://ffmpeg.org/download.html) on your `PATH`.

## Connect your agent

```sh
calliopa agent install claude   # Claude Code
calliopa agent install codex    # Codex
```

This registers calliopa's MCP server with the agent and installs a skill it reads. Restart
the agent, then ask it for a previs. `calliopa agent remove claude` undoes it.

## Documentation

[docs/index.md](docs/index.md) covers the commands, the MCP tools, the spec and the modules.

## Licence

calliopa is licensed under the [calliopa Licence](LICENSE.md).
