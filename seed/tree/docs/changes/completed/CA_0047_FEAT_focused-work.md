# CA_0047_FEAT_focused-work

Status: completed

Requested: 2026-09-13, the third part of `BO_0243` (decision and refinement, a change of this repository). The material's sections 4, 8, 9, 43, 48 and 49, product scenario 2, and screen 3 (a child root opened from the caching block). A `ui.shell` change.

## Where This Starts

At head 391, served pin 387.

- **A block cannot hold blocks.** A `text` block has runs and a role; only `document` is a permitted `CONTAINS` origin, and moving between containers waits on a container type nobody has introduced (`CA_0007_010`). Structure is a tree, and a block belongs to one document.

- **A document is reached from the library or a tab.** The `Documents` category lists parentless documents by title; opening one opens a tab keyed by its identity; the tab strip is the navigation ([Tabs], [Layout]). Nothing records how a reader arrived at a document.

- **A tab keeps its own selection and scroll.** Selection, active block and drawer context are the tab's; scroll is browser-local per tab (`CA_0014_005` open). The route a reader took is not among what a tab keeps.

- **Nothing renders one document inside another.** A parent document has no way to show what a child concluded; a reader who investigated a paragraph elsewhere carries the result back by hand.

## Intent

* **Any block can be opened as focused work.** The focused block becomes the current work root: the interface then shows an intent — its words — a body, a refinement state, evidence, questions, relations and a next move of its own, and returning to the containing work copies nothing: the parent renders the child's current synthesis as the block's face (material §8).

* **The affordance is discoverable.** A focused block's expansion ends with *Open as focused work →*, and on touch a pinch inward on a block does the same; back, or a pinch outward, returns to the containing work (material §42, §43). The reader never thinks *create a new document*.

* **Navigation is route, not ontology.** The route above the intent — *Permission model › Authorization caching › Caching safety across revisions* — is the path by which the reader arrived at the current focus, and nothing else: it has no effect on governance, ownership, policy or containment, and two routes may lead to one root (material §9, rule 20).

* **Work drifts naturally.** A block becomes independently focusable when it has accumulated enough of its own — evidence, questions, alternatives, a synthesis, a frontier — and the reader simply opens it; no conceptual migration is asked of them (material §48).

* **Branch scope is not a visual subtree.** Opening a block as focused work changes nothing about what is accepted; scoped acceptance is `BO_0250`'s.

## The Shape

- **A focused work is a document that `focuses` a block**: an `ext.relationtype` `focuses` declared by `ui.shell`, an edge from the child `document` to the `text` block it elaborates. A block is focused by at most one document — the shell's rule, checked before the write as single containment is. The block keeps its place in its parent; the child document is parentless in the library's sense and is listed there as any document is, under its title.

- **Opening** compiles into one mutation: create the document titled with the block's words (the one claim it asserts, when it asserts exactly one), and the `focuses` edge; then open it in the same tab, pushing the parent onto the tab's route. A block already focused by a document opens that document. Opening is a human content write, confirmation-free.

- **The route is the tab's.** A tab gains `route`: the ordered documents the reader passed through to reach its target, stored with the tab in the workspace record so it survives reloads and devices as the tab does. Opening focused work pushes; *Back* pops and restores the parent with the block focused; opening a document from the library or the search starts a route of one. The route renders as the breadcrumb in the header for the active tab (`CA_0048` moves it into the frame's line; until then it renders above the document's headline, inside the view).

- **The parent's face.** The block's own runs stay what the reader reads; when the child holds a `synthesis` block, the parent's block gains a second, muted line under its text — the child's current synthesis — and its affordance line names *Focused work*. Pressing either opens the child. The parent's runs are not overwritten: whether a child's synthesis should replace the parent's wording is a proposal a run may make (`BO_0246`), answered like any rewrite.

- **Pinch.** On touch, `use-pinch.ts` beside the swipe adapter: a two-finger pinch inward on a reading row past a threshold opens it as focused work; a pinch outward anywhere on the surface goes back. Physics pure and unit-tested as `swipe.ts` is; no gesture is the only path — the expansion's last line and the header's back control are the others.

- **Reframing** (material §49) is renaming the intent, which the title already allows; a reframed intent is a revision of the document node with its history. No new operation.

- **Verification**: behaviour tests over CCGW for the `focuses` write, the one-child rule and the read-back; the render harness for the route push and pop and the parent's face; Playwright for open, back and the breadcrumb on both form factors; the pinch measured on a phone in the walk-through.

## Decided

* **The child's title is the block's words** when the block asserts no single claim: truncated at the first sentence, editable at once. Asking for a title before opening — the *create a new document* moment the material forbids — was the alternative. User decision, 2026-09-13.

* **A focused block may be moved in its parent and is not retired while its child stands.** Retiring a block that has focused work is refused with the child named, until the child is deleted or the `focuses` edge is closed; nothing cascades, as the deletion rule for documents never does. Retiring the block and leaving the child reachable from the library was the alternative. User decision, 2026-09-13.

## Depends On

- `CA_0046` for the focus fact and the expansion the affordance ends. `BO_0246` for the synthesis the parent's face shows; until then the face shows the child's title.
