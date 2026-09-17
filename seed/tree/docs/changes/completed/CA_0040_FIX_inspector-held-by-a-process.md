# CA_0040_FIX_inspector-held-by-a-process

Status: completed

Requested: 2026-09-10. **In the graph, the status of `CA_0039` cannot be changed.** User statement. Where the document's facts belong, the inspector read *Process — write a brief intro for agent context — completed — Done — Proposed — This run proposed nothing.*

## Where This Starts

- **Pressing a process row in the dock console pins the inspector to that process, and nothing releases it.** The row's press sets `registry.selectedId` (`src/components/shell/shell.tsx`, the console's process list). The inspector renders the process detail whenever `selectedId` names a process in the registry, and the active view's contribution only otherwise. No code sets it back to `null`: not opening a document, not switching tabs, not pressing the same row again, not closing the phone's inspector sheet, not the run finishing. Only a page reload clears it, because the selection is held in the page and not in the workspace record. Served at pin 205.

- **So every view's contribution is out of reach while a process is selected**: a change document's Status choice, the retired, discarded and proposed toggles, rename and delete. The status write itself is sound. No attempt on `CA_0039` reached the graph, and the write last established on 2026-09-10.

- **The docs already promise the release.** *Inspector* in `docs/system/workspace/layout.md`: "A selected process still takes the inspector. Process detail is transient and the reader chose it, so the view's contribution returns when the selection is cleared." There is no way to clear it. And *Tabs* in `docs/system/workspace/tabs.md` holds as fixed truth that each tab retains its own drawer context, while the process selection is one for the whole shell.

- **Until this lands:** reload the page, then use the inspector before pressing a process row.

## Intent

* A reader who looked at a process can always get back to the active view's inspector without reloading, on both form factors.

* Looking at a process stays one press in the console, and its detail is unchanged: state, step, error, acknowledgment, and what it proposed.

## The Shape

- **The selected process is held per tab.** Each tab keeps its own selection, the way the fixed line in *Tabs* keeps each tab's drawer context. Switching tabs, including opening a document, which activates its tab, shows that tab's inspector: its own selected process if it has one, and its view's contribution otherwise. Coming back to a tab shows its process again. A closed tab takes its selection with it. With no tab open, the empty workspace holds its own. The selection lives in the page only, as it does now, and is never written to the workspace record, because process detail is transient.

- **Two ways to release it in place.** One is a labelled *Close process* button in the process detail. The other is a second press on the selected row in the console, which toggles the selection off; the row says it is pressed (`aria-pressed`). The button is labelled rather than a ×, because the phone's inspector sheet already carries a × that closes the sheet. Either way, the release clears the console row's selected state, so the console and the inspector never disagree about what is selected.

## Decided

- **Switching tabs:** the selection is held per tab. Decided by the user on 2026-09-10.

- **Releasing in place:** both a labelled *Close process* button in the detail and a second press on the selected console row. Decided by the user on 2026-09-10.

## Verification

First, the defect reproduced in Qwik's render harness through the shell's own JSX: select a process from the console, and the active view's contribution is gone. After the fix, in the harness: *Close process* and a second press on the row each bring the contribution back and clear the row's selected state; a process selected on one tab stays with that tab while another tab shows its own inspector, and shows again on the way back. Then on the served build, on a desktop and on a phone: select a process, release it both ways, switch tabs with one selected, and set `CA_0039`'s status in the inspector.

## Transfer

Transferred on 2026-09-10 as `CA_0040_001`–`CA_0040_004` into the shell's docs, staged as `node:chg-1eb9a9438f90d15e`. `_001`, `_002` and `_004` are under *Inspector* in `docs/system/workspace/layout.md`, and `_003` is in `docs/system/workspace/processes.md`. `_001` comes first, since the other two build on its per-tab selection; `_002` and `_003` follow in either order, and `_004` comes after promotion. One technical choice was made at the transfer, because no harness today mounts the whole shell: the selection rule becomes a pure module in `src/lib/`, and the inspector's choice between process detail and contribution becomes its own component, so the render harness can mount it.
