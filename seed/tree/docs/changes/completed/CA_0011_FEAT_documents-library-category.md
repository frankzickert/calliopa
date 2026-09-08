# CA_0011_FEAT_documents-library-category

Status: completed

Requested: 2026-08-30

## Intent

The left drawer is empty and the only way to reach a document is to make a new
one from the header. Documents exist in the graph but the workspace never shows
which ones exist, so a document that is not in an open tab is unreachable.

This change gives the left drawer its first top-level category, `Documents`,
listing every parentless document in the graph, and moves the header's `+doc`
control into a small `+` in that category's header.

## Documents Category

- The left drawer holds a top-level category `Documents`.
- The category lists every `document` node in the graph that has no containment
  parent.
- Today no document has a parent, because `contains` only originates from a
  document and only targets a block, so the parentless filter currently selects
  every document. The filter is stated as the rule rather than as "all
  documents" so nesting documents later narrows the list instead of rewriting it.
- Each entry names the document by its title.
- Entries are ordered by title, ascending. Documents sharing a title tie, so the
  order breaks by creation order to stay deterministic; without a tie-break the
  several documents named "Untitled document" would shuffle between reads.
- The entry for the active tab's document reads as selected. The selected state
  carries a marker or accessible state, not colour alone, so the axe scans stay
  clean.
- Activating an entry opens that document in a tab, using the same open path an
  existing tab uses, so a document already open is revealed rather than opened
  twice.
- With no document in the graph the category shows an empty-state line under its
  heading, so the region reads as a place that holds things rather than as
  something that failed to load.
- The category is collapsible, and its collapsed state is stored in the
  workspace record alongside tabs and layout, so it follows the workspace across
  reloads and devices.

## Category Header Control

- The category header carries a small `+` control that creates a new document.
- The header's `+doc` button is removed. The category's `+` is the only way to
  create a document, and it sits next to the documents it creates.
- The `+` keeps the current create behaviour: it creates the document in the
  graph and opens it in its own tab.
- A newly created document appears in the category without a reload.
- The `+` is a transparent icon button in the shell's quiet chrome idiom, with
  its own accessible name, not a bordered form button.

## Titles

- A document's title is editable in its tab, and renaming it updates that
  document's entry in the category without a reload.
- This absorbs `CA_0008_011` from [Block Editor View](../../system/documents/block-editor.md),
  which gives the document title its editing affordance. A live-updating list
  needs something that renames a document, and nothing in the editor does today,
  so the affordance and the live entry are one behaviour and ship together.
- The list otherwise reflects what it read. A title changed through the API
  elsewhere appears on the next drawer read; nothing polls the listing.

## Listing Documents

- No listing capability exists today. `src/server/documents/documents.ts`
  creates and reads one document by identity, and the gateway answers only
  rooted reads, so "every node of this type" is not expressible.
- The gateway gains root resolution by node type: a typed operation answering
  the logical identities of a node type within the graph scope. It traverses
  nothing and returns identities, which then feed an ordinary rooted read.
- Root resolution stays inside the gateway. The documents module never reads
  graph tables directly, so the gateway's boundary rule holds.
- The gateway's reads rule is amended: root resolution by type is how a consumer
  obtains roots it cannot name in advance, and traversal remains rooted and
  bounded.
- The listing is exposed through the existing `/api/documents` route as its
  read method.

## Supersedes

- [Workspace Shell](../../system/workspace/frame.md) currently says the left drawer
  ships with nothing at all and arrives expanded while the library holds
  nothing, and that the header offers a new document. Both lines change here.
- The workspace record gains the category's collapsed state, so its stored
  layout is no longer only tabs, active tab, and drawer and dock state.
- The mobile left sheet currently carries only its close control. It carries the
  `Documents` category too once this lands.
- [Block Editor View](../../system/documents/block-editor.md) loses its open
  `CA_0008_011`, which this change absorbs.

## Verification Impact

- `tests/browser/layout.spec.ts` asserts the empty drawer today and must assert
  the `Documents` category instead, on desktop and in the mobile sheet.
- Any browser test that creates a document through the header's `+doc` control
  must drive the category header's `+` instead.
- Scenarios belonging with the library tests: create-then-appear, activate to
  open, the selected entry following the active tab, the empty-state line, the
  collapsed state surviving a reload, and a rename in a tab reaching the entry.
- The axe scans must stay clean with the category present, expanded and
  collapsed.
- `pnpm run verify` gates the result.

## System Work

The specification was transferred into `docs/system/` and enumerated as
`CA_0011_001` through `CA_0011_008`, and every one of those is folded into
current truth:

- [Graph Gateway](../../system/content-store/graph-gateway.md) gained root resolution by node
  type (`CA_0011_001`). Its fixed reads rule now says root resolution is how a
  consumer obtains roots it cannot name in advance, and that traversal remains
  rooted and bounded. The boundary rule was not touched: the lookup lives
  inside the gateway, so no feature reads graph tables directly.
- [Block Document Model](../../system/documents/block-document-model.md) gained the
  parentless-document listing and its transport (`CA_0011_002`,
  `CA_0011_003`).
- [Block Editor View](../../system/documents/block-editor.md) gained the editable
  document title (`CA_0011_004`), which superseded and removed `CA_0008_011`.
- [Workspace Shell](../../system/workspace/frame.md) gained the `Documents`
  category, the moved `+`, the collapsed state in the workspace record, and the
  live entry (`CA_0011_005`-`CA_0011_008`).

Two things learned while building it are recorded there rather than here: the
listing is global, because documents live in the graph rather than in a
workspace, and the rendered list is rebuilt rather than reconciled, because
entries move and are renamed in the same read.
