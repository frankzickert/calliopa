import {
  $,
  component$,
  createContextId,
  Slot,
  useContext,
  useContextProvider,
  useOnDocument,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";

import type { DocumentDecorationProps } from "~/contract";
import { EditorSurfaceContext } from "~/extensions/documents/views/editor-surface";

import type { DocumentStructuresView, StructuresListing, StructureView } from "../lib/structures";

/**
 * The structures a document's editor draws from: read once per document — the
 * catalogue and the document's structures — shared with the label on every block
 * and the structure control in the chip through this context, and read again
 * whenever the editor reads the document again. Nothing here writes to the
 * bar: a structure is taken from the block's own chip, and the document's from the
 * chip under its title (`calliopa-bootstrap`'s `BO_0318`, folded into
 * `BO_0309`).
 */

export interface StructuresState {
  loaded: boolean;
  reachable: boolean;
  catalogue: readonly StructureView[];
  view: DocumentStructuresView | null;
  busy: boolean;
  /** A structure a label's press asks the control to open at, on its block;
   * `""` for the document's own. */
  opening: { subject: string; structure: string } | null;
}

export const StructuresContext = createContextId<StructuresState>("structures.structures");

export type Answer = {
  outcome: string;
  result?: DocumentStructuresView;
  detail?: string;
  failures?: readonly { detail: string }[];
};

export const detailOf = (answer: Answer, status: number): string =>
  answer.failures?.map((failure) => failure.detail).join(" ") ??
  answer.detail ??
  `The server answered ${status}.`;

/** Reads the catalogue and the document's structures into the state. */
export async function readStructures(state: StructuresState, documentId: string): Promise<void> {
  const [listing, structures] = await Promise.all([
    fetch("/api/library/structures/structures").catch(() => null),
    fetch(`/api/x/structures/documents/${encodeURIComponent(documentId)}`).catch(() => null),
  ]);
  if (listing !== null && listing.ok) {
    const body = (await listing.json().catch(() => null)) as StructuresListing | null;
    state.reachable = body?.reachable === true;
    state.catalogue = [...(body?.structures ?? [])];
  }
  if (structures !== null && structures.ok) {
    const answer = (await structures.json().catch(() => ({ outcome: "refused" }))) as Answer;
    if (answer.outcome === "success" && answer.result !== undefined) state.view = answer.result;
  }
  state.loaded = true;
}

/**
 * The event a write's answer is announced by. The chip under the title holds
 * a state of its own, since the title stands outside the document's
 * decoration provider: whichever state wrote, the other takes the document's
 * structures it answered, so a document's structure taken under the title offers its
 * structures to the blocks at once.
 */
export const STRUCTURES_CHANGED = "structures-changed";

function announce(view: DocumentStructuresView, on: EventTarget | null): void {
  // Made by the page itself, so the event is the page's own kind.
  const page = on as Document | null;
  if (page === null || typeof page.createEvent !== "function") return;
  const event = page.createEvent("Event");
  event.initEvent(STRUCTURES_CHANGED, false, false);
  Object.defineProperty(event, "detail", { value: view });
  page.dispatchEvent(event);
}

/** Takes an announced view when it is this document's. */
export function adopt(state: StructuresState, documentId: string, event: Event): void {
  const view = (event as CustomEvent<DocumentStructuresView>).detail;
  if (view !== undefined && view !== null && view.documentId === documentId) state.view = view;
}

/**
 * Posts one act on a document's or a block's structures and takes the document's
 * structures it answers, or the refusal in the route's words. `on` is the page the
 * answer is announced on: the pressed control's own document.
 */
export async function postStructures(
  state: StructuresState,
  path: string,
  body: Record<string, unknown>,
  on: EventTarget | null = null,
): Promise<string | null> {
  if (state.busy) return null;
  state.busy = true;
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (response === null) return "The server could not be reached.";
    const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as Answer;
    if (response.ok && answer.outcome === "success" && answer.result !== undefined) {
      state.view = answer.result;
      announce(answer.result, on);
      return null;
    }
    return detailOf(answer, response.status);
  } finally {
    state.busy = false;
  }
}

export const StructuresProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const surface = useContext(EditorSurfaceContext);
  const state = useStore<StructuresState>({
    loaded: false,
    reachable: false,
    catalogue: [],
    view: null,
    busy: false,
    opening: null,
  });
  useContextProvider(StructuresContext, state);

  // eslint-disable-next-line qwik/no-use-visible-task -- the structures are read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    track(() => surface.loaded);
    await readStructures(state, id);
  });

  useOnDocument(
    STRUCTURES_CHANGED,
    $((event: Event) => adopt(state, documentId, event)),
  );

  return <Slot />;
});
