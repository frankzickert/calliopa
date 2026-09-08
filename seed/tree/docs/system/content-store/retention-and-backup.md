# Retention And Backup

## Retention And Backup

- This topic is a link since `BO_0207_016`. What it described — retention over the shell's own database and bucket — retired with the shell's stores; what is kept and how it is restored is the core's now.
- History is the graph's and is never cleaned up; backup and restore of the graph and its blob store are the core's (`garage-backup-and-restore.md`, `BO_0207_010`). The shell holds nothing to back up: its working state and party secrets are the kernel's (`ui-kernel.md`, `BO_0207_002`, `BO_0207_003`).
- The shell keeps no database, no bucket key and no gateway of its own (`ui-shell.md`, `BO_0207`); the history of the retired implementation stays in this topic's earlier revisions.
