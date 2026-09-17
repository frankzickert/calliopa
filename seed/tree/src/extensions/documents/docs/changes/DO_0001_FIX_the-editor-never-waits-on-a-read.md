# DO_0001_FIX_the-editor-never-waits-on-a-read

Status: completed

Requested: 2026-09-16, by the user, after deactivating `calliopa-refine` left the served shell
unusable: the tabs and the library stopped answering while the composer's agent picker still did,
and a reload did not help. Shipped ahead of `calliopa-bootstrap`'s `BO_0257`, which makes the reads
themselves fast (user decision, 2026-09-16). `ready` since the user accepted it on 2026-09-16;
implemented, served from pin 1234 and completed by the user after the walk the same day.

The block editor never holds the page while a read or a write is under way. A slow read makes a
count arrive late; it never makes a tab, the library or a block stop answering.

## Where This Starts

- **Qwik holds rendering until a `useTask$` settles.** A task whose body awaits the network keeps
  every render the page asks for waiting behind it: no tab switches, no library entry opens, no
  block activates. A native control — the composer's agent `<select>` — still answers, which is
  what the user saw.
- **The editor has two such tasks** (`views/block-editor.tsx`): the counts task awaits
  `reloadChanges$` and `reloadProposals$` — up to three proposal reads — whenever the document
  loads or its save state changes; the drop task awaits a proposal's placement or a block's move.
- **Reproduced headless on the instance at pin 1157** (2026-09-16): a click on the `settings` tab
  while `Walkthrough`'s proposals were read took effect only after two proposal reads returned,
  about 5.5 s later. The workspace reopens a document on every load, so a reload lands in the same
  wait.
- **`calliopa-refine`'s decision provider has the same shape twice** — the judgements read on every
  document read and the depth reads on every block focus (`views/decision/provider.tsx`). That is
  `calliopa-refine`'s own change, not this one.

## Shape

- The counts task and the drop task become visible tasks (`useVisibleTask$`) that keep awaiting
  their reads and writes: a visible task runs after the render and holds none. Merely not awaiting
  inside `useTask$` was tried and is wrong — no block opens at all in the render harness.
- The render harness waits for the reads the editor starts, and a suite idles its last editor
  before it unstubs `fetch`: ten editor suites asserted proposals, counts or the dock right after
  mounting, and a read started by a late render reached the next test's real `fetch`.
- Proven where it lives: in the render harness, with the proposals read held for two seconds, a
  press on a block activates it before the read answers — measured 85 ms with the visible task,
  after the read without it.

## Open Points

- `calliopa-refine`'s two tasks in `views/decision/provider.tsx` await their reads the same way;
  that is `calliopa-refine`'s own open work, in its `docs/system/system.md`.
