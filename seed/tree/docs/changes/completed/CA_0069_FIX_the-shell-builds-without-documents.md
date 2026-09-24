# The Shell Builds Without Documents

Status: completed

Found on 2026-09-24 while cutting release `0.4.0`, fixed and verified the same day. The release
script's absence check (`calliopa-bootstrap`'s `docs/system/distribution.md`, The Absence Check)
refused the cut: at accepted pin 2521 the tree did not build without `documents`, so a release
carrying that pin would have given an owner who switches `documents` off an install that cannot
promote.

```
without bibliography, code, documents, manuscripts, media, publishing, relations:
  pnpm run --silent typecheck exited with code 2
  tests/behavior/focus.test.ts(10,8): error TS2307: Cannot find module
    '~/extensions/documents/server/documents'
  tests/behavior/focus.test.ts(11,50): error TS2307: Cannot find module
    '~/extensions/documents/server/focus'
  tests/behavior/focus.test.ts(13,40): error TS2307: Cannot find module
    '~/extensions/documents/server/work-ops'
```

Every other variant built: without `bibliography, manuscripts`, without `code`, without
`manuscripts`, without `media`, without `publishing`, without `relations`.

## What Was Wrong

- `tests/behavior/focus.test.ts` is the shell's own behaviour suite, landed by `CA_0065` when
  focused work became a shell capability. It proves `src/server/focused-work.ts`, which is the
  shell's, by driving it through `documents`' server operations — `createDocument`,
  `insertBlock`, `reviseTextBlock`, `retireBlock`, `readDocument`, `childTitle`,
  `DOCUMENT_TARGET_KIND`, `addClaim` and `setBlockKind`.
- A file the shell keeps may not import an extension an owner may switch off. The rule is the
  shell's own: [Verification](../../system/foundation/verification.md) records, for
  `BO_0255_010`, that a copy of the tree without `src/extensions/documents/` must typecheck and
  build. `CA_0065` left this file behind that rule, and nothing caught it until a release was
  cut — the same shape `CA_0051` fixed when `settings`' `parties.test.ts` imported `publishing`.

## What Was Done

- The suite moved to the extension whose modules it needs: `tests/behavior/focus.test.ts` is now
  `src/extensions/documents/tests/behavior/focus.test.ts`, beside `documents.test.ts` and
  `branch.test.ts`. Not a line of it changed — `~/…` resolves from the source root either way, and
  an extension may import the shell — so the move is behaviour-preserving: the same suite runs
  under the kernel harness, and it goes away with the extension it needs. Focused work keeps its
  proof wherever `documents` is present, which is every install that has documents at all; an
  install without `documents` has no focused work to prove.
- [Verification](../../system/foundation/verification.md) carries the rule as a line of its own,
  so the next suite that reaches into an extension is answered before a release finds it.

## Verified

- `kernel toolchain absence --tree` on a copy of pin 2521's tree with the release's own pruning
  (the four extensions `release-extensions.json` does not ship removed) and the suite moved:
  every variant builds — *without bibliography, code, documents, manuscripts, media, publishing,
  relations*, *without bibliography, manuscripts*, *without code*, *without manuscripts*,
  *without media*, *without publishing*, *without relations* — exit 0, where the same check on
  the unmoved tree refused the first of them.
- The release `0.4.0` was cut at the pin that carries this change.

## Ships

- Nothing an owner notices: a behaviour suite moved between subtrees of the same release. No
  release-notes line.
