# DO_0002_FIX_proposals-on-an-empty-document

Status: completed

Requested: 2026-09-18, by the user, who asked a question from the command bar with a new, empty
document open. The run staged its answer, and neither the run's end nor *Show proposed changes*
showed anything. The user asked for the fix the same day ("create the fix"). Served from pin 75
and walked by the user on the served build the same day; completed 2026-09-18.

A proposal standing against an empty document is shown when the reader asks to see it, and is
answerable where it is drawn.

## Where This Starts

- **The run did its work.** Run `arun-6686d082f569b2b8` staged group `node:run-6686d082f569b2b8`
  on `Chat interface`: a rewrite of the document's one empty block, ten inserted blocks, and claims
  and relations. `readDocumentProposals` read on the instance answered 11 unanswered items.
- **The editor drew a blank page in their place.** The blank page (`emptyDocument`: no blocks, or
  one text block with no text) replaces the whole block list, and proposals are drawn inside that
  list. The check made an exception for revealed retired blocks and none for proposals, so the
  toggle turned on and nothing appeared. The run's end turns the toggle on (`BO_0226_007`) and
  failed the same way.
- **A document is created with one empty block**, so this is the first thing a reader tries with
  a new document. A document a run *started* is drawn from `proposed` (`BO_0251_010`) and was
  never affected.

## Shape

- The blank page stands only while `shownProposals` is empty (`views/block-editor.tsx`). That
  also covers a system run's derived candidates, which are shown with the toggle off.
- `views/proposals/empty-document.test.ts` presses it in the render harness: with the toggle off,
  an empty document with a rewrite and an insert standing reads as the blank page; with the toggle
  pressed, both items are drawn and the blank page is gone. The test was red before the change;
  the `documents` unit suite passes (27 files, 257 tests) and the tree typechecks.
