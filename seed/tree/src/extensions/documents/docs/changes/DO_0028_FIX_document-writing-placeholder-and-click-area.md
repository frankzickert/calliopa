# DO_0028_FIX_document-writing-placeholder-and-click-area

Status: draft

The document's *Write Something* placeholder does not sit where the first text of a block would
begin, and the writing target below the last block covers too little space. The user asks for the
placeholder to share the first block's text starting position and for the whole remaining document
area below the last drawn block to start writing when clicked.

## Scope

- The owner is documents, which owns the block editor and its empty-document and below-last-block
  writing surfaces. This change belongs to that extension and uses its DO prefix.
- On a blank document, *Write Something* begins at the same text origin as the first block's text,
  so it appears where typing would begin. This applies both when the document has no blocks and when
  it has the one empty text block that represents a new document.
- In reading mode, the remaining document area after the last drawn row is a click target for
  starting a paragraph below that row. The target fills the available area of the document rather
  than only a short strip adjacent to the last row.
- On a blank document, the placeholder's full document area is clickable to start writing.
- Keep existing writing semantics: a press while a block is active only ends that edit; command
  mode remains a reading surface; a trailing empty paragraph is activated rather than duplicated;
  and a drag onto the blank page or below-last-row target remains a drop, not a writing click.
- The editor documentation now carries the claimable DO_0028_001 task and its behavior
  scenarios. Implementation waits until the user sets this change to ready.
