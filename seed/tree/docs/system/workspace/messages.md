# Messages

## Messages

* A message is shell chrome. A view raises one through the view bridge; a view never renders one itself.
* The message surface is out of the shell's flow. Raising or lowering a message moves no content in the header, either drawer, the workspace, or the dock.
* A raised message takes focus and holds it. The rest of the frame is inert while it asks, and `Escape` cancels.
* A message waits until it is answered. The surface carries no timer, and nothing on it dismisses itself.

- A message has a headline, a body line, and one or more answers. The view supplies the words and the handler behind each answer; the shell decides how a message reads and where it sits, and renders a destructive answer as one, the way it already renders a destructive inspector action.
- Every message asks. A statement with no answers, of the kind that would fade after a few seconds, is not built, and the surface has no lifetime for one to use. The change that needs a fading notice adds it, and answers then what such a notice does while a question holds the floor.
- One message exists at a time, because a second cannot be raised while the first holds the floor. The surface holds a message or nothing, so it needs no queue, no stack, and no rule for which message replaces which.
- The surface is `role="alertdialog"` with `aria-modal="true"`, and the frame behind it is `inert`. Focus enters the message when it is raised and returns to the control that raised it when it is answered.
- `Escape` cancels rather than doing nothing. Cancelling is the answer that changes nothing, so it is the safe one to reach by reflex.
- Holding the floor does not make this a place that traps the reader. [Process Registry](./processes.md#process-registry) fixes that against long processes; a message is an immediate action answered in place, which is the row in [Async-Native Interaction Model](./processes.md#async-native-interaction-model) that gets an inline response.
- Process errors do not move here. They stay attached to the operation and affected item until acknowledged or resolved, as [Process Registry](./processes.md#process-registry) fixes, and this surface must not be read as permission to weaken that.
- The surface sits above the frame on the same layer as the drag preview, rather than each overlay inventing a layer of its own. It is in the markup only while it holds a message; an empty surface reserving space would be back in the layout by another name.
- A message is raised above every region, so the region holding the control that raised it does not matter. The block editor's delete confirmation is raised from an inspector action, and on a phone the inspector sheet would otherwise cover the question it just asked.

## Implementation

- `src/components/shell/view-bridge.ts` carries the message contract and `raiseMessage$`: a headline, a body line, and at least one answer, each answer a label the shell renders and an optional `run$` the view supplies. An answer that changes nothing carries no handler, which is what `Cancel` is, so cancelling is not an answer whose handler undoes the question (`CA_0018_001`).
- `MessageSurface` is its own component and renders outside `main.shell`. Both follow from what a message must not disturb: re-rendering the shell to raise one would rebuild the element under the caret, and a surface inside the frame would be disabled along with everything else when the frame goes inert (`CA_0018_001`, `CA_0018_002`).
- The frame is made inert imperatively from the surface's visible task rather than by the shell rendering an `inert` it would have to read the message to decide. The task runs on `document-ready` rather than the default: the component renders nothing at all while no message is up, and a task waiting for an element to intersect would never run to see the first one arrive (`CA_0018_002`).
- The control focus returns to is a `noSerialize` signal. It is read before the frame goes inert, because that blurs whatever is focused, and refocused after the frame is released, because an inert element cannot take focus (`CA_0018_002`).
- `inert` is not a focus trap by itself: it keeps focus off the frame, but the document still takes a turn in the tab cycle, which is a way out of a question that must not have one. The surface wraps `Tab` and `Shift+Tab` between its first and last answer, and that is what closes the turn (`CA_0018_002`).
- `Escape` is bound on the document while a message is up, not on the surface, so it cancels wherever focus sits; the listener is removed as the message is lowered (`CA_0018_002`).
- A tab switch clears the message along with the inspector contribution and the save state. A question left standing over a different tab would ask about a document the reader is no longer looking at, and answering it would act on that one (`CA_0018_001`).
- `.message-layer` is fixed over the whole viewport on the drag preview's layer and passes pointer events through, so it covers nothing the message itself does not. The card is centred in it, so where it sits depends on neither the header's height nor the dock's (`CA_0018_001`).
- `tests/browser/block-editor.spec.ts` proves the surface on desktop and mobile: the document's title and first block occupying the same rectangle with a message raised and lowered, the question reachable without putting the inspector away, focus arriving on the message and `Tab` never leaving it, the frame carrying `inert` while a press aimed straight at a control behind it does nothing, `Escape` cancelling and giving focus back to the control that raised it, and the axe scan clean while a message asks (`CA_0018_001`, `CA_0018_002`).
