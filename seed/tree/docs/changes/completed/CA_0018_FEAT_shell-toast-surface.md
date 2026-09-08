# CA_0018_FEAT_shell-toast-surface

Status: completed

Requested: 2026-08-30

## Intent

The delete confirmation is the only approval message in the product, and the
block editor renders it itself, inline, above the document. It sits in the
editor area's flow, so raising it pushes the title and every block down the
page, and lowering it pulls them back up. The reader is asked a question by
having their document move.

This change gives the shell one message surface, off the main layout, and moves
the delete confirmation into it. The confirmation keeps everything it says: it
still asks before deleting, still names the document by title, and cancelling
still changes nothing. What changes is who owns the surface, where it renders,
and whether the question can be ignored.

The surface is reusable from the start. It belongs to the shell, any mounted
view raises a message on it through the view bridge, and no view renders one of
its own. Reusable here means shell-owned and reachable by every view, not a
speculative set of message kinds: this change builds the one kind the delete
needs, in the place the next message will be raised from.

## Why The Shell Owns It

* A message surface is shell chrome. A view raises a message; it never renders
  one.

- [Workspace Shell](../../system/workspace/frame.md) already fixes that a mounted
  view reaches the shell through one declared bridge and that the shell renders
  those surfaces, because a view never owns one. The inline confirmation is the
  one place a view does own a surface today, so this change closes a gap rather
  than opening a new boundary.
- The bridge already carries the shape this needs. The inspector's actions are
  the precedent: the view says what an action is and supplies what it does, and
  the shell decides how a button and a destructive button look. A message is
  the same division — the view supplies the words and the answer handlers, the
  shell decides how a message reads and where it sits.
- Owning it once is what makes the second message cheap and the tenth
  consistent. Two views each drawing their own confirmation would drift in
  wording, in placement, and in what the keyboard does.
- The trigger and the message are in different regions today. `Delete` is an
  inspector action and the confirmation renders in the workspace, so on a phone
  the inspector sheet covers the question it just raised; the browser scenario
  has to close the inspector before it can see the confirmation at all. A
  surface on its own layer is above every region and has no such relationship
  to the one the reader pressed a control in.

## Off The Main Layout

* The message surface is out of the shell's flow. Raising or lowering a message
  moves no content in the header, either drawer, the workspace, or the dock.

- This is the whole point of the change. The inline confirmation reflows the
  document it is asking about, which is the least stable moment to move the
  thing the reader is deciding about.
- The shell frame is bounded and does not scroll as a whole, and its three
  regions scroll their own content. A message that participated in any of those
  layouts would either scroll away from the question it is asking or bound a
  region it does not belong to.
- The shell already has an out-of-flow overlay in the drag preview, fixed to
  the viewport above the frame. The message surface is the second, and the two
  should read as belonging to the same layer rather than each inventing one.
- The surface is present in the markup only while it holds a message. An empty
  surface reserving space would be back in the layout by another name.

## A Question Holds The Floor

* A raised message takes focus and holds it. The rest of the frame is inert
  while it asks, and `Escape` cancels.

- Being off the layout and holding the floor are separate properties, and this
  change wants both. The message moves no content, and it is also the only
  thing the reader can answer.
- Deleting is the one operation in the product that no undo covers, which is
  already why it asks. An approval the reader can walk away from — leaving the
  question on screen while they edit something else, or raise the same question
  about a second document — is a weaker approval than the inline one it
  replaces, and this change is not the place to weaken it.
- The surface is `role="alertdialog"` with `aria-modal="true"`, and the frame
  behind it is `inert`. The inline confirmation already declares
  `role="dialog" aria-modal="true"` and backs it with nothing: no focus move,
  no focus trap, no `Escape` handling, and every control on the page still
  reachable behind it. It tells a screen reader the rest of the page is hidden
  while it is not. This change makes that claim true rather than dropping it.
- One message exists at a time, because a second cannot be raised while the
  first holds the floor. The surface holds a message or nothing, and needs no
  queue, no stack, and no rule for which message replaces which.
- `Escape` cancels rather than doing nothing. Cancelling is the answer that
  changes nothing, so it is the safe one to reach by reflex.
- This does not make the shell a place that traps the reader.
  [Workspace Shell](../../system/workspace/frame.md) fixes that against long
  processes, and this is an immediate action answered in place — the row in
  that document's interaction model that gets an inline response.

## What A Message Is

* A message waits until it is answered. The surface carries no timer, and
  nothing on it dismisses itself.

- A message has a headline, a body line, and one or more answers. The delete
  confirmation is a message with two, `Cancel` and `Delete`, and `Delete` reads
  as destructive the same way the inspector's destructive button does.
- Every message asks. A statement with no answers, of the kind that would fade
  after a few seconds, is not built here and the surface has no lifetime for one
  to use. The change that needs a fading notice adds it, and answers then what
  such a notice does while a question holds the floor.
- The view supplies the words. The shell does not know what a document is or
  what deleting one means, which is the same reason the inspector's actions
  carry their handlers from the view.
- The words are the ones the confirmation already uses: `Delete “<title>”?`,
  and that this removes the document from the product and cannot be undone.
  This change moves the message, it does not rewrite it.

## What This Is Not

* Process errors do not move here. [Workspace Shell](../../system/workspace/frame.md)
  fixes that errors stay attached to the operation and affected item until
  acknowledged or resolved, and that a toast alone is insufficient. That line
  stands unchanged, and this surface must not be read as permission to weaken
  it.

- The block editor's refusal notices stay on the block they happened to. A
  document-level surface cannot name a block, which is why they are there.
- A long process still never traps the reader in a blocking dialog. Nothing in
  this change gives a process a way to raise a message, and the one message that
  exists is answered in the same breath the reader raised it.
- The header's save state is not a message. It is a state the reader can look
  up, not an event that arrived, and it already has its place.

## Verification Impact

- `tests/browser/block-editor.spec.ts` reaches the confirmation through
  `[data-confirm-delete]`, `[data-confirm-cancel]`, and
  `[data-confirm-delete-go]`. Those scenarios keep asserting the same
  behaviour — the confirmation naming the document, cancelling changing
  nothing, and deleting closing the tab and clearing the library entry — and
  are rewritten against whatever the shell surface names its parts. Their
  `closeInspector` step goes with the region relationship that made it
  necessary.
- Scenarios belonging with this change, on desktop and mobile: the document's
  title and first block occupying the same rectangle with a message raised and
  lowered; focus arriving inside the message when it is raised and not leaving
  it by `Tab`; a control behind the message not reachable while it asks;
  `Escape` cancelling and changing nothing; and focus returning to the control
  that raised the message once it is answered.
- The axe scans must stay clean on both form factors with a message showing.
- `pnpm run verify` gates the result.

## System Work

Transferred. The tasks below are the authoritative work; this document does not
duplicate them.

No open question remains: the surface holds the floor, holds one message, and
waits.

[Workspace Shell](../../system/workspace/frame.md) gains a `Messages` section
carrying the four fixed lines above — a message is shell chrome a view raises
and never renders, the surface is out of the shell's flow, a raised message
takes focus and holds it while the frame is inert, and a message waits until it
is answered — with the two tasks under them. Its bridge line in `Qwik
Boundaries` gains raising a message, and is corrected to the fields the bridge
actually carries.

- `CA_0018_001` adds the surface and the bridge field, and moves the block
  editor's delete confirmation onto it as its first and only caller. It
  deliberately claims no modality: no `aria-modal`, no focus move, no `inert`,
  because a surface that does not hold focus must not tell a screen reader the
  page behind it is hidden.
- `CA_0018_002` makes the message hold the floor, and adds `aria-modal="true"`
  along with the behaviour that makes the claim true. It is where the standing
  defect is settled — the confirmation being replaced declares
  `role="dialog" aria-modal="true"` and backs it with nothing.

[Block Editor View](../../system/documents/block-editor.md) gains one line under
`Deleting A Document` saying the confirmation is a message raised through the
bridge rather than rendered by the view, pointing at `CA_0018_001`. Its fixed
line that the panel's `Delete` asks first and names the document by title is
untouched and must stay true. Its truth lines describing the confirmation the
view owns and renders in its own area are current truth until `CA_0018_001`
completes, and are folded then rather than now.
