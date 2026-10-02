# Focused Work Shows Without Focusing The Block

Status: completed

Requested: 2026-09-30, by the user. A block should show right away when it has focused work or children. Today that indication can arrive only after the block is clicked. This change starts the target-wide faces read as the document enters reading presentation and keeps the page responsive while it answers.

## Behavior

- When a document is opened, blocks that already have focused work show its face and the block control reflects that child without requiring the reader to focus or click each block first.
- A block with focused work remains recognizable while the document is first displayed and after it is read again. Blocks without focused work gain no child indicator.
- The indicator continues to show the child's own words when available and its title otherwise; pressing it still opens that focused work.
- The delay in showing existing children is removed. The implementation may choose the read and cache shape that keeps the document responsive.

## Scope

- The `documents` block editor renders the face and control state. The shell's focused-work capability answers the faces through `faces$`.
- The document now reads the target's faces as it enters reading presentation, after the first render, so untouched blocks with children are identified without holding the page.
- The focused-work model, child creation, navigation, and what the face says do not change.

## System Task

- `DO_0029_001` in `block-editor.md`, *Focused Work*, covers the initial nonblocking faces read, the visible result and control state, the render-harness cases, and the corresponding timing update in the frame's Focused Work topic.

## Functional Questions

- None identified. The requested outcome is that existing focused work is visible as soon as the document is shown, without a click.

## Notes

- `documents` owns the visible block presentation. The release note is in `docs/release-notes/unreleased.md` under *Changed*.
- The current behavior is described in `documents`' `block-editor.md`, *Focused Work*, and the shell's `workspace/focused-work.md`.

## Verification

- `pnpm exec vitest run --project unit src/extensions/documents/views/focused-work.test.ts`: 7 tests pass. `nesting.test.ts`: all 7 assertions pass; Vitest reports unhandled Qwik `Must be same function` errors from the render harness after the assertions. The current full typecheck also reports three `toggleMark` errors in branch and marking tests, outside the files changed here.
