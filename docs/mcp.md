# MCP tools

`calliopa mcp` serves four tools over standard input and output. They answer exactly what
the [commands](commands.md) answer; an answer with errors is a tool error carrying
`{"errors": [...]}`. Their descriptions name the installed modules and their summaries.

| Tool | Arguments | Answer |
| --- | --- | --- |
| `list` | none | the available modules |
| `describe` | `module` | the module's declaration |
| `validate` | `spec`, the spec as a JSON object | `{"ok": true}` or the errors |
| `render` | `spec`, and `out`, the mp4's path (best absolute) | the outputs, as `calliopa render` answers them |

`render` sends a progress notification for every frame it writes, to a client that asks
for progress, since a long render takes minutes.

`calliopa agent install claude` (or `codex`) registers the server with your agent, so you
seldom start it yourself.
