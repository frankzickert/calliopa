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

import type { DocumentRolesView, RolesListing, RoleView } from "../lib/roles";

/**
 * The roles a document's editor draws from: read once per document — the
 * catalogue and the document's roles — shared with the label on every block
 * and the role control in the chip through this context, and read again
 * whenever the editor reads the document again. Nothing here writes to the
 * bar: a role is taken from the block's own chip, and the document's from the
 * chip under its title (`calliopa-bootstrap`'s `BO_0318`, folded into
 * `BO_0309`).
 */

export interface RolesState {
  loaded: boolean;
  reachable: boolean;
  catalogue: readonly RoleView[];
  view: DocumentRolesView | null;
  busy: boolean;
  /** A role a label's press asks the control to open at, on its block;
   * `""` for the document's own. */
  opening: { subject: string; role: string } | null;
}

export const RolesContext = createContextId<RolesState>("doc-block-roles.roles");

export type Answer = {
  outcome: string;
  result?: DocumentRolesView;
  detail?: string;
  failures?: readonly { detail: string }[];
};

export const detailOf = (answer: Answer, status: number): string =>
  answer.failures?.map((failure) => failure.detail).join(" ") ??
  answer.detail ??
  `The server answered ${status}.`;

/** Reads the catalogue and the document's roles into the state. */
export async function readRoles(state: RolesState, documentId: string): Promise<void> {
  const [listing, roles] = await Promise.all([
    fetch("/api/library/doc-block-roles/roles").catch(() => null),
    fetch(`/api/x/doc-block-roles/documents/${encodeURIComponent(documentId)}`).catch(() => null),
  ]);
  if (listing !== null && listing.ok) {
    const body = (await listing.json().catch(() => null)) as RolesListing | null;
    state.reachable = body?.reachable === true;
    state.catalogue = [...(body?.roles ?? [])];
  }
  if (roles !== null && roles.ok) {
    const answer = (await roles.json().catch(() => ({ outcome: "refused" }))) as Answer;
    if (answer.outcome === "success" && answer.result !== undefined) state.view = answer.result;
  }
  state.loaded = true;
}

/**
 * The event a write's answer is announced by. The chip under the title holds
 * a state of its own, since the title stands outside the document's
 * decoration provider: whichever state wrote, the other takes the document's
 * roles it answered, so a document's role taken under the title offers its
 * roles to the blocks at once.
 */
export const ROLES_CHANGED = "doc-block-roles-changed";

function announce(view: DocumentRolesView, on: EventTarget | null): void {
  // Made by the page itself, so the event is the page's own kind.
  const page = on as Document | null;
  if (page === null || typeof page.createEvent !== "function") return;
  const event = page.createEvent("Event");
  event.initEvent(ROLES_CHANGED, false, false);
  Object.defineProperty(event, "detail", { value: view });
  page.dispatchEvent(event);
}

/** Takes an announced view when it is this document's. */
export function adopt(state: RolesState, documentId: string, event: Event): void {
  const view = (event as CustomEvent<DocumentRolesView>).detail;
  if (view !== undefined && view !== null && view.documentId === documentId) state.view = view;
}

/**
 * Posts one act on a document's or a block's roles and takes the document's
 * roles it answers, or the refusal in the route's words. `on` is the page the
 * answer is announced on: the pressed control's own document.
 */
export async function postRoles(
  state: RolesState,
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

export const RolesProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const surface = useContext(EditorSurfaceContext);
  const state = useStore<RolesState>({
    loaded: false,
    reachable: false,
    catalogue: [],
    view: null,
    busy: false,
    opening: null,
  });
  useContextProvider(RolesContext, state);

  // eslint-disable-next-line qwik/no-use-visible-task -- the roles are read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    track(() => surface.loaded);
    await readRoles(state, id);
  });

  useOnDocument(
    ROLES_CHANGED,
    $((event: Event) => adopt(state, documentId, event)),
  );

  return <Slot />;
});
