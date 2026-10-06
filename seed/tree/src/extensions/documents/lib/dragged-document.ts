/**
 * A document dragged into a document (`DO_0043_004`): what the shell's drag
 * model hands a view when a document's tab or its library row is dragged,
 * told apart from a block dragged out of a view's content, which carries the
 * same kind with the content as its source.
 */

/** The kind a document's tab and its library row drag as. */
export const DOCUMENT_DRAG_KIND = "documents:document";

/** The document a payload drags, when it is a whole document from its tab or
 * its library row offering a move; `null` for anything else. */
export function draggedDocument(
  payload: { readonly itemId: string; readonly kind: string; readonly source: string; readonly operations?: readonly string[] } | null | undefined,
): string | null {
  if (payload == null || payload.kind !== DOCUMENT_DRAG_KIND) return null;
  if (payload.source !== "tab-strip" && payload.source !== "library") return null;
  if (payload.operations !== undefined && !payload.operations.includes("move")) return null;
  return payload.itemId;
}

/** Whether the document a view shows is the one being dragged over it, which
 * lands nowhere in itself and so lights no place. */
export const draggedOverItself = (
  payload: Parameters<typeof draggedDocument>[0],
  documentId: string | null,
): boolean => documentId !== null && draggedDocument(payload) === documentId;
