# System

## Purpose

- `documents` is the block document model and the surface that reads and edits it: a document as a graph node with ordered blocks, the Documents category that lists them, and the block editor that presents one.
- It left `ui.shell` under `BO_0255` (2026-09-16), the second part of `calliopa-bootstrap`'s `BO_0253`, so the shell is the frame and extension administration alone and nothing keeps a privileged path into it. `calliopa-video` (`BO_0203`) is the precedent for the move.
* This extension's change documents use the prefix `DO`, as `docs/process/change-process.md` in `calliopa-bootstrap` requires a new extension to name (`BO_0255_002`).

## What It Is

- `category: bundled`: every release carries it, and it is part of the Apache-2.0 body the distribution ships.
- It is not in the kernel's code-registered required set, so an instance may switch it off. A tree without it builds and serves: the Documents category is absent and a tab that remembers a document opens in the frame's `context` placeholder, which is what makes view resolution total.
- The Documents section stands under the *Docs* icon in the shell's icon column, Phosphor `files` (`ui.shell`'s `CA_0056`, [Contribution Contract](../../../../../docs/system/workspace/contribution-contract.md); `CA_0056_009`).
- It declares no dependency. `publishing` and `calliopa-video` declare one on it, because a prose item and an episode's body are documents.

## Areas

### documents

- [Block Document Model](./documents/block-document-model.md) — documents, blocks, the block vocabulary, ordering, containment, retirement and structural operations.
- [Block Editor View](./documents/block-editor.md) — reading presentation, in-place editing, saving, structural gestures and the action surfaces.
- [Proposed Changes](./documents/proposed-changes.md) — what a run stages into a document and how a person answers it in place.
- [Document Panel](./documents/document-panel.md) — the document's facts, its depth and the phase marker.
- [Command Mode](./documents/command-mode.md) — passages, references and the standing a reader gives a block.
- [Schema Evolution](./documents/schema-evolution.md) — how the vocabulary changes.

## Vocabulary

- Under `BO_0256`, promoted to draft by the user on 2026-09-16 and transferred here the same day, the decision half leaves this extension for `calliopa-refine`, which flips to `individual` — the last part of `calliopa-bootstrap`'s `BO_0253`. The repository's half is `extension-model.md` `BO_0256_001`–`BO_0256_003`, `ui-kernel.md` `BO_0256_004` and `distribution.md` `BO_0256_005`. What stays here is the block document model and the surface that reads and edits it; what leaves is everything that says what a block *means*.
- [ ] BO_0256_006 This extension keeps `document`, `text`, `divider` and `retired`, and defines `BlockKind` and `RootPhase` as ordinary graph types whose instances are declarations, enumerating neither (`BO_0199`, Declaration By Instance). `claim`, `relation` and `policy` with `asserts`, `source`, `target`, `derivedFrom`, `focuses` and `acceptedBy` move to `calliopa-refine`, which declares the sixteen kinds and the three phases as instances of the two slots. `text.kind` and `document.phase`/`supersededBy` come off the declarations and are written undeclared; `disposition` stays declared here, as the reading gesture `BO_0227` made it.

- The extension declares `document`, `text` and `divider` as `ext.blocktype` members and `retired` as an `ext.relationtype`; `claim`, `relation` and `policy` with `asserts`, `source`, `target`, `derivedFrom`, `focuses` and `acceptedBy` travel with them and leave for `calliopa-refine` under `BO_0256`.
