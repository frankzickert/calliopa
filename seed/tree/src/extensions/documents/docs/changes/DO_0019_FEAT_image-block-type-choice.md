# Image Block Type Choice

Status: completed

Requested: 2026-09-28, by the user: make Image available in the editor's block type picker beside Paragraph, Heading, and the other block choices.

## Behavior

- The block type picker offers `Image` alongside the text roles for a text block and offers those text roles for an image block.
- Choosing `Image` changes a text block into an empty image upload block at the same position. Its text becomes the image caption, which the person can edit independently of uploading the image.
- The conversion removes formatting marks but preserves linked text and its destination. Links in an image caption can be followed and edited using the editor's existing link behavior.
- Changing an image block to a text role restores the caption as the text block's content, keeping its links and without restoring removed formatting.
- The existing *Add image* action remains available for inserting a new image block below the bar's subject.

## Implementation

- Image captions use linked text runs without formatting marks. The block type picker converts text blocks into empty image upload blocks and image blocks back into text roles at the same position.
- Focused unit coverage: image caption validation and reading, conversion command parsing, the picker in both directions, and editable linked captions alongside image upload fields.
