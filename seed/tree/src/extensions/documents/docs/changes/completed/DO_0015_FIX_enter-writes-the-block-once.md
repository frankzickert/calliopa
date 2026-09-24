# Enter Writes The Block Once

Status: completed

Pressing Enter in a block just typed into is refused by the kernel with `write_too_frequent:
node … was written less than 250ms ago; coalesce edits in the editor — every save archives a
revision into permanent history`, the split folds back, and the block does not open another
block below it. The user reported it on 2026-09-23 ("whenever I click enter on a block"), and
decided: pressing plain Enter must never show this error and must work by opening another
block; and the *Send as prompt* button must show `Ctrl+Enter` as a tooltip, since the shortcut
is nowhere on screen today. Completed 2026-09-23: every task is folded into
truth in [Block Editor](../system/documents/block-editor.md#enter-writes-the-block-once) and
[Command Mode](../system/documents/command-mode.md#blocks-as-commands), the user's walk
(`DO_0015_005`, pin 1834) included.

## Cause

- The kernel refuses a second write to one node inside 250ms of the first (`stageFloor`,
  `internal/kernel/serve/write.go`, `BO_0134_001`), on the ground that coalescing edits is the
  editor's job: every write archives a revision for good. The floor keys on every node-shaped
  parameter a statement carries, so a split keys the head, the document and the tail.
- The editor's split sends two writes to the head back to back (`landSplit$`,
  `views/block-editor.tsx`; `block-editor.md` line *A split is sent after it is drawn: the head's
  words first, when they differ from what the graph holds, then the split*). Whenever the reader
  typed anything since the last pause save — that is, Enter within the pause save (`SAVE_PAUSE_MS`, 1.2s) of the last keystroke,
  the ordinary way to write — the first is a `revise` of the head and the second, the `split`,
  writes the head again (`SET b.runs = $head`) a few milliseconds later. The kernel refuses the
  split, the tail folds back into the head, and the refusal is named on the block. The server
  splits the runs the graph holds at the base revision, which is why the words are written first.
- Two Enters inside 250ms — the way a reader leaves an empty line — collide the same way even
  without typing: the second split writes the tail the first created and the document node the
  first related, both inside the floor. The drain sends splits one at a time, but sends the next
  the moment the previous answers.
- `Ctrl`/`Cmd`+`Enter` on a block just typed into fails in the same family: `sendBlock$` saves the
  block (a `revise`), sends the command, and writes the `prompt` standing (`setDisposition`) to
  the same node inside the floor. The run has started by then; only the standing is refused and
  the block stays in the flow. Clicking *Send as prompt* runs the same code and works only because
  reaching for the mouse outlasts the pause save, so the save writes nothing. The old shell's
  disposition write retried the floor (`BO_0138`, `BO_0145` name it as a consequence to honor);
  the documents extension's standing writer does not.

## Scope

- The owner is `documents`: the editor, its split, its command control and its server commands
  are its. So this change document is its member and the prefix is `DO`.
- **Enter is one write per node.** The split carries the head's words: the editor sends the
  split with the runs and role it holds, and the server's `split` splits those rather than the
  runs at the base revision and writes head and tail in one script. `landSplit$` sends no separate
  `revise`. The base revision still guards the split, so a stale base is still a conflict that
  writes nothing, and a refused split still folds back (`CA_0045_005`).
- **Consecutive splits wait the floor out.** The drain does not send a split inside 250ms of the
  previous one's answer, and a split the floor refuses anyway is sent once more after the floor
  rather than folded back — the pacing the server's `commitEach` already does for a two-script
  gesture. A fold-back stays the answer to every other refusal.
- **Sending a block just typed into writes its standing after the floor.** The standing write in
  `views/standing/use-standing.ts` treats `write_too_frequent` as the retryable refusal it is and
  sends once more after the floor, so `Ctrl`/`Cmd`+`Enter` and a fast press on *Send as prompt*
  make the block a prompt. This restores what `BO_0138` recorded and the move into the extension
  dropped.
- **The Send button names its shortcut.** *Send as prompt*'s title carries the shortcut:
  `Send as prompt · Ctrl+Enter`, the cost after it as today (`Send as prompt · Ctrl+Enter · about
  …`). On an Apple platform it reads `⌘+Enter`, the key the listener also takes (`metaKey`) — my
  technical decision, since the label is words for a key that already works both ways.
- Out of scope: the kernel and its floor (`BO_0134` is correct as it stands and its diagnostic says
  what the editor must do), the pause save's length, and any change to how a merge writes.

## Verification

- `views/handover.test.ts`: Enter after typing sends one command, the split, carrying the head's
  words; two quick Enters make three blocks with the second split sent no sooner than the floor
  after the first answered; a split refused as `write_too_frequent` is sent again and lands, and
  one refused for any other reason folds back as before.
- `command/command-control.test.ts`: the *Send as prompt* title names `Ctrl+Enter`; a standing
  write refused by the floor is sent again and the block leaves the flow.
- `tests/behavior` (the kernel harness, real Postgres): a split carrying words the graph does not
  hold lands them in the head and the tail in one write, and a stale base is refused.
- The walk: type into a block and press Enter at once — the block opens another block below and
  nothing is named on it; press Enter twice fast — an empty block between; type and press
  `Ctrl`+`Enter` at once — the block becomes a prompt; hover *Send as prompt* — the tooltip shows
  the shortcut.

## Transfer

- Transferred 2026-09-23 from head 1808: `DO_0015_001`–`DO_0015_006` in [Block Editor](../system/documents/block-editor.md#enter-writes-the-block-once) and `DO_0015_007` in [Command Mode](../system/documents/command-mode.md#blocks-as-commands). Implementation waits for ready.
