# Graph Gateway

## Graph Gateway

- This topic is a link since `BO_0207_016`. What it described — the `src/server/graph/` gateway: typed reads, assembly, mutation, conflict and schema composition over the shell's own store, deleted under `BO_0207_020` — retired with the shell's stores; the typed boundary over the graph is the core's now.
- Reads are CCGW's statement route at `CALLIOPA_CCGW_URL`; writes are the kernel bridge's `write`, `stage`, `accept` and `reject` verbs at `CALLIOPA_KERNEL_URL` (`ui-kernel.md`); validation is CCGW's Validation over the vocabulary the shell declares as `ui.shell` members. The outcome vocabulary lives in `src/server/outcome.ts` and the shared write shapes in `src/server/ccgw/script.ts`.
- The shell keeps no database, no bucket key and no gateway of its own (`ui-shell.md`, `BO_0207`); the history of the retired implementation stays in this topic's earlier revisions.
