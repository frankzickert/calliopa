# CA_0050_FEAT_workspace-on-the-view-bridge

Status: completed

Requested: 2026-09-14, for `PU_0009` in `publishing`: a view that starts a process needs the reader's workspace id, and the view bridge does not carry it. The shell's own producer, the agent run started from the dock composer, takes the workspace from the shell it runs in; a contributed view has only its tab and the bridge.

## Intent

* The view bridge carries the workspace the view is mounted in — `workspaceId` — so a contributed view can create a process for it through the shell's own registry, the way the composer's run does. Read-only; a view never changes the workspace it is in.

* The process registry accepts a producer beyond the agent run: a process an extension's route creates and moves through `createProcess` and `moveProcess` is shown on the same four surfaces with no further contract — the item kind is one the registry knows, qualified by the extension, as `parseProcessInput` already requires.

## Design

- `ViewBridge.workspaceId: string` in `src/components/shell/view-bridge.ts`, set where the bridge is built in `shell.tsx` from the workspace the shell holds; the contribution contract names it beside the inspector and the dock.

- `docs/system/workspace/processes.md` loses *the agent run is the registry's only producer*: a publish (`PU_0009`) is the second.

## Out Of Scope

- Any change to the registry's states, surfaces or polling.
