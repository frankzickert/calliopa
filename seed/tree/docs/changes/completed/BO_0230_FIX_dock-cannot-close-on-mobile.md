# BO_0230_FIX_dock-cannot-close-on-mobile

Status: completed

Requested: 2026-09-10, at the close of `BO_0227`'s walk-through. **The command bar cannot be closed on mobile.** User statement.

## Where This Starts

- **The dock has a way to close on every form factor, in the model.** Three positions — `collapsed`, `composer`, `console` (`DOCK_POSITIONS`, `src/lib/layout.ts`). A tap on the handle cycles forward (`dockAfterTap`: composer → console → collapsed); a release that travelled at least `DOCK_SWIPE_THRESHOLD` (40px) is a swipe and moves one position in its own direction (`dockAfterSwipe`), so a downward swipe from the composer collapses it. `dockAfterRelease` in `shell.tsx` applies the one transition on `pointerup`; a click with `detail` of 0 is keyboard activation (`CA_0024`). `layout.spec.ts` in the retired browser suite proved the cycle and the swipe on both form factors.

- **So something on a phone defeats it, and what is not yet known.** Candidates to rule in or out at the transfer, on a phone against the served build, not by reading:

- the dock is taller since `BO_0225`–`BO_0227` — the agent's row, the delivery row, the disclosure, the `#` offer — so on a short screen the handle may sit off-screen or under the on-screen keyboard;

- a focused command field raises the keyboard, and the reader has no way to dismiss it that does not also leave the dock where it is;

- a tap cycles *forward*, so from the composer the first tap opens the console — which reads as the dock growing rather than closing — and only the second tap collapses it;

- a gesture elsewhere in the page (`BO_0227`'s swipe adapter listens on the document) taking the handle's pointer sequence — the adapter returns at once for a press outside a reading row, which the transfer should confirm on the device.

## Intent

* On a phone the reader can put the dock away in one obvious gesture, and bring it back, from any of its positions.

* Closing it never costs what was typed in the command field.

## The Shape

- **The handle is the way to close, and on a phone it answers neither gesture.** The reader tried both — a tap on the grey handle and a vertical swipe on it — and the dock stayed open. So this is a defect in how the handle's gesture arrives or is applied on touch, not a missing control. The transfer reproduces it on a phone against the served build before anything is written, and the cause names the fix. What the candidates above predict: an element over the handle takes the press; the handle scrolls out of reach behind a taller dock or the keyboard; or the handle's `pointerup` never reaches `dockAfterRelease` on touch (the first-tap fault `CA_0024` fixed had this shape).

- **A tap on the handle closes an open dock** — from the composer and from the console — and opens a collapsed one to the composer. Today a tap cycles forward, so from the composer it opens the console first, which reads as the dock growing; closing is what a reader reaching for the handle of an open dock means.

- **A vertical swipe moves one position in its own direction**, as it does now: down towards collapsed, up towards the console. The console stays reachable by a swipe up and by the header's console control.

- **No new control.** The handle carries both gestures, on every form factor.

- **Closing costs nothing typed.** The command field keeps its text across a close and a reopen.

## Decided

Decided by the user on 2026-09-10:

- **What was tried:** a tap on the handle and a vertical swipe on it; neither closed the dock.

- **How closing works:** by the handle — a tap, or a vertical swipe. No separate close button, and no change that leaves the handle as the way it does not work.

## Verification

First the defect, reproduced on a phone against the served build before the fix and named. Then, on the same phone after it: a tap on the handle closes the dock from the composer and from the console, and opens it from collapsed; a swipe down closes it and a swipe up opens it a position; with the command field focused and the keyboard up, the handle still closes it; what was typed survives a close and a reopen. The tap's new rule is unit-tested beside the swipe's in `src/lib/layout.test.ts`, and the gesture pressed in Qwik's render harness through the shell's own JSX (`qwik-member-props-freeze`).

## Transfer

Transferred on 2026-09-10 as `BO_0230_001`–`BO_0230_005` under *The Dock On A Phone* in `docs/system/ui-shell.md`: the reproduction on the phone, the tap that closes, the swipe reaching the handle on touch, the tree tests and the verification on the phone. At the transfer the handle's gesture code read sound for both gestures; the tap's forward cycle is a confirmed cause, and the handle's 32px hit area is the swipe's candidate. Order: `_001` first, since its finding decides `_003`; `_002` with it; `_004` and `_005` follow.

## Found

Reported by the user on 2026-09-10 against the served build: the dock expands but never collapses, and on a phone the handle's row lies over the document's content and takes no touch. The two causes compound. A tap from the composer opened the console (`_002`, the forward cycle). In the console's position the dock grew taller than the room the phone grid leaves it, which takes the workspace's row to nothing while the workspace's padding still spills over the dock's top edge. The document's rows are positioned and the dock was not, so the rows painted over the handle and took the press. The fix is the tap rule, a layer of the dock's own, the growing parts scrolling inside themselves at phone width, and a 44px handle (`BO_0230_002`, `BO_0230_003`).

## Closed (2026-09-10)

**Completed on the user's word — "accepted" — after promotion to pin 228.** The fix was staged as `node:chg-d3e347137bdcfae2` from a fresh checkout at dataRevision 220; its overlay read back identical to the tested tree; it was accepted with `BO_0231` and promoted at pin 228, where the combined tree type-checks and passes 526 tests. The cause is the one *Found* names; the report the user sent from the phone was the reproduction `_001` asked for, read against the stylesheet rather than measured in a phone's inspector.

No follow-up is open.
