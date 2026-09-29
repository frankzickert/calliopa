# Fix Admonition Child Navigation Regression

Status: wip

Requested: 2026-09-29, by the user after deploying `DO_0021`: the “Add paragraph” button reappeared, and Up/Down navigation between admonition child paragraphs does not work.

## Behavior

- Remove the child-local “Add paragraph” button. Keep paragraph creation through Enter and the editor's existing block insertion controls.
- Up and Down continue through visual lines inside a child. At the first or last visual line, they move to the adjacent child and retain the horizontal caret position.
- Keep the accepted Enter split and Backspace/Delete merge behavior.
- Verify the rendered admonition has no “Add paragraph” button and exercise Up/Down across single-line and wrapped child paragraphs in the browser.
