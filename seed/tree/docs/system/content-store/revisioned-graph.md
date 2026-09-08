# Revisioned Graph

## Revisioned Graph

- This topic is a link since `BO_0207_016`. What it described — the `src/server/graph/` primitives, transactions and as-of reads over the shell's own Postgres — retired with the shell's stores; the durable content store is the core's now.
- The shell's content lives in the one graph: CCGW's revisioned nodes, relations and validity windows, pinned reads at any data revision, and the candidate and established lifecycle are `ccgw.md`'s and `data-model.md`'s in the core; bytes are blobs under `binary-content.md`.
- The shell keeps no database, no bucket key and no gateway of its own (`ui-shell.md`, `BO_0207`); the history of the retired implementation stays in this topic's earlier revisions.
