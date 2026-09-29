# Add Image Blocks

Status: completed

The document editor can display image blocks, but its *Add …* controls do not let a
person upload one into a document. Add an image upload flow; this change does not create
images.

## The Ask

- Make image blocks available from the document editor's block insertion controls.
- *Add image* inserts an empty upload field; the person then chooses an image file to
  upload into the document. This is an upload flow, not image generation.
- Keep insertion consistent with the existing rule that a new block is placed directly
  below the row it is added from, including when that row is a proposal.

## Behavior

- Given a document row is the block bar's subject, when the person chooses *Add image*,
  then an empty image block with an upload field appears directly below that subject.
- Given an empty image upload field, when the person chooses an image file, then its
  bytes are uploaded and the same image block displays the selected image.
- Given the person cancels the picker or an upload fails, then the empty image block
  remains available for another attempt and the failure is explained.

## Implementation Task

- `DO_0018_001` and `DO_0018_002` in the documents extension's [Block Editor View](../system/documents/block-editor.md#pictures-and-moving-pictures) are complete. The interaction cases run through the extension's Qwik render harness; responsive layout is not measured by that harness.
