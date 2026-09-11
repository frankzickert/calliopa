import {
  createContextId,
  useStore,
  useVisibleTask$,
  type Signal,
} from "@builder.io/qwik";

import { passageState, type Marking } from "~/lib/references";
import { runsText } from "~/lib/runs";
import type { BlockView } from "~/server/documents/assemble";
import {
  paintPassages,
  type PaintedPassage,
  type PassageBadge,
} from "./painter";
import { selectedWords, type SelectedWords } from "./selection";

/**
 * Passages on the page: the words a reader has selected in command mode, and
 * where each marked passage's number is drawn. BO_0227_009
 *
 * The selection is tracked here and read by the affordance alone, never by
 * the rows' render: a selection changing must not re-render the text being
 * selected, or the browser collapses it — what `BO_0137` measured when a
 * selection died within a frame under the old editor's re-render.
 */
export interface PassagesStore {
  /** The words selected in command mode, or null. */
  selected: SelectedWords | null;
  /** Each block's passage numbers and where they sit in its row. */
  badges: Readonly<Record<string, readonly PassageBadge[]>>;
}

export const PassagesContext = createContextId<PassagesStore>(
  "block-editor.passages",
);

/** The resolved passages to paint; a stale one has no words to paint over. */
export function paintable(
  marking: Marking,
  blocks: readonly BlockView[],
): readonly PaintedPassage[] {
  const texts = new Map(
    blocks.flatMap((block) =>
      block.kind === "text"
        ? [[block.blockId, runsText(block.runs)] as const]
        : [],
    ),
  );
  return marking.references.flatMap((reference) => {
    if (reference.kind !== "passage") return [];
    const state = passageState(reference, texts.get(reference.blockId) ?? "");
    return state.stale
      ? []
      : [
          {
            blockId: reference.blockId,
            number: reference.number,
            ...state.range,
          },
        ];
  });
}

export function usePassages(input: {
  readonly root: Signal<HTMLElement | undefined>;
  readonly surface: {
    readonly document: { readonly blocks: readonly BlockView[] } | null;
    readonly loaded: number;
  };
  readonly marking: { readonly marking: Marking };
}): PassagesStore {
  const { root, surface, marking } = input;
  const store = useStore<PassagesStore>({ selected: null, badges: {} });

  // The selection, while in command mode. A browser fires `selectionchange`
  // on the document for every change, including the collapse that ends one.
  useVisibleTask$(({ track, cleanup }) => {
    const mode = track(() => marking.marking.mode);
    const page = root.value?.ownerDocument;
    if (page === undefined) return;
    if (mode !== "command") {
      store.selected = null;
      return;
    }
    const changed = () => {
      store.selected = selectedWords(page);
    };
    page.addEventListener("selectionchange", changed);
    cleanup(() => page.removeEventListener("selectionchange", changed));
  });

  // The paint, whenever what is marked, the mode or the document changes, and
  // when the page is resized, since a number's place is a place on screen.
  // Leaving the mode leaves no trace: nothing is painted and no number drawn.
  useVisibleTask$(({ track, cleanup }) => {
    const current = track(() => marking.marking);
    track(() => surface.loaded);
    const document = track(() => surface.document);
    const element = root.value;
    if (element === undefined) return;
    const paint = () => {
      store.badges =
        current.mode === "command" && document !== null
          ? paintPassages(element, paintable(current, document.blocks))
          : paintPassages(element, []);
    };
    paint();
    const frame = element.ownerDocument.defaultView;
    frame?.addEventListener("resize", paint);
    cleanup(() => frame?.removeEventListener("resize", paint));
  });

  return store;
}
