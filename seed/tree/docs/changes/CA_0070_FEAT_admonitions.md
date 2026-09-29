# CA_0070_FEAT_admonitions

Status: completed

Requested: 2026-09-28, by the user: add admonition callouts to `ui.shell`, matching
`docs/material/Screenshot 2026-09-28 081503.png`.

## Behavior

- Documents owns admonition blocks and graph-backed named patterns. A pattern has a
  color, optional image, and optional footline; its color supplies the accent rule
  and pale body tint.
- An admonition block references a named pattern and contains ordered child blocks.
  Patterns can be reused in any document.
- The image overlaps the leading edge of the callout and the footline aligns at the
  bottom right.
- Editing a reusable pattern updates every existing callout that references it.
  User decision, 2026-09-28.
- ui.shell owns the left-panel entry and management surface for creating, listing,
  and editing patterns, through the documents extension.
- Admonition patterns appears as its own left-rail icon, separate from the Extensions
  category; its named pattern manager remains reusable across documents.

## Tasks

- `CA_0070_001` — documents block model: pattern and block data, validation, reads,
  writes, and cross-document reuse.
- `CA_0070_002` — documents block editor: insert and edit admonition containers,
  apply saved patterns, render nested content, and support container-aware editing.
- `CA_0070_003` — ui.shell: left-panel pattern manager integrated with documents.
- `CA_0070_004` — ui.shell: give Admonition patterns a standalone left-rail icon.

The task lines are in the owning system documents. Admonitions contain ordered editable text blocks; Enter splits a child at the caret, and adding a paragraph appends a child.
