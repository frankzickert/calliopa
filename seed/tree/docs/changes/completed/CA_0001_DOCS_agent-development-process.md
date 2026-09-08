# CA_0001_DOCS_agent-development-process

Status: completed

Requested: 2026-08-29

## Summary

The repository uses the same docs-first change process as `studio`, adapted to the `calliopa` repository and shared by Codex, Claude, and other agents through `AGENTS.md`.

The initial process bootstrap was directly requested by the user before this repository had a change process to govern it. Future changes follow the process now documented in `docs/process/change-process.md`.

## Result

- `AGENTS.md` is the shared entry point for all agents.
- `CLAUDE.md` points Claude sessions to the shared rules without duplicating them.
- `docs/changes/` coordinates work through `idea`, `draft`, `ready`, `wip`, and `completed` states.
- `docs/system/` is authoritative for system truth and claimable implementation tasks.
- `docs/maps/` routes agents to the smallest relevant documentation.
- `docs/process/` defines change approval, collaboration, documentation, engineering, and verification expectations.
- Change and task identifiers use the `CA` repository prefix.
