import { component$, createContextId, Slot, useContext, useContextProvider, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { DocumentDecorationProps } from "~/contract";
import { EditorSurfaceContext } from "~/extensions/documents/views/editor-surface";

import type { RenditionView } from "../lib/rendition";

/**
 * A document's renditions (`calliopa-bootstrap`'s `BO_0312_022`), read once
 * per document and again whenever the editor reads the document again — a
 * run's rendition lands with its other proposals — and shared with every
 * block's `below` place and the document's `end` place through this context.
 */
export interface RenditionsState {
  loaded: boolean;
  renditions: readonly RenditionView[];
}

export const RenditionsContext = createContextId<RenditionsState>("manuscripts.renditions");

export const RenditionsProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const surface = useContext(EditorSurfaceContext);
  const state = useStore<RenditionsState>({ loaded: false, renditions: [] });
  useContextProvider(RenditionsContext, state);

  // eslint-disable-next-line qwik/no-use-visible-task -- the renditions are read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    track(() => surface.loaded);
    const answer = await fetch(`/api/x/manuscripts/renditions?document=${encodeURIComponent(id)}`).catch(() => null);
    state.loaded = true;
    if (answer === null || !answer.ok) return;
    const body = (await answer.json().catch(() => null)) as { renditions?: RenditionView[] } | null;
    state.renditions = body?.renditions ?? [];
  });

  return <Slot />;
});
