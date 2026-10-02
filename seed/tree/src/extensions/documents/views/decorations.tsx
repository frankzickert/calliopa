import { component$, Slot, type JSXOutput, type QRL } from "@builder.io/qwik";

import { REGISTRY } from "~/registry.gen";
import type { BlockPlace, Decorations, DocumentPlace, DocumentPlaceForm } from "~/contract";

/**
 * The decorations contributed for this extension's blocks (`BO_0256_007`).
 *
 * The editor renders these and knows nothing of what fills them: an extension
 * contributes components for a block's headline, its depth or the space below
 * it, and a tree holding no such extension renders an undecorated block.
 * Places are drawn in extension order.
 */
export const KIND = "documents:document";

const sets = () => REGISTRY.decorations[KIND] ?? [];

/** Whether any decorating extension contributes this block place, so a view
 * drawing a frame around a place — the chip under the command chip — draws
 * none when nothing would stand in it. RO_0002_002 */
export const placeContributed = (at: BlockPlace): boolean =>
  sets().some(({ decorations }) => decorations.places[at] !== undefined);

export const BlockDecorations = component$<{
  at: BlockPlace;
  documentId: string;
  blockId: string;
  revisionId: string;
  active: boolean;
  /** The `command` place's: sets an option on the command it is drawn in.
   * The command control hands it over; no other place has one. BO_0311_030 */
  setOption$?: QRL<(name: string, value: string | null) => void>;
}>(({ at, documentId, blockId, revisionId, active, setOption$ }) => (
  <>
    {sets().map(({ extension, decorations }) => {
      const Drawn = decorations.places[at];
      return Drawn === undefined ? null : (
        <Drawn
          key={`${extension}:${at}`}
          documentId={documentId}
          blockId={blockId}
          revisionId={revisionId}
          active={active}
          {...(setOption$ === undefined ? {} : { setOption$ })}
        />
      );
    })}
  </>
));

/**
 * The contributed providers, wrapped around the document's blocks so a
 * decoration set reads the document once and shares it through its own
 * context rather than fetching per block. Every extension that provides for
 * the kind is mounted, nested in extension order (BO_0289_019): the second
 * decorating extension was the change that made the one wrapper a nest.
 */
export const DecorationProvider = component$<{ documentId: string }>(
  ({ documentId }) => {
    const providers = sets().flatMap((set) =>
      set.decorations.provider === undefined ? [] : [set.decorations.provider],
    );
    // The nest is composed from the inside out: the projected content, then
    // each provider around it, the last extension's innermost.
    let inner: JSXOutput = <Slot />;
    for (let index = providers.length - 1; index >= 0; index -= 1) {
      const Provider = providers[index] as NonNullable<Decorations["provider"]>;
      inner = <Provider documentId={documentId}>{inner}</Provider>;
    }
    return inner;
  },
);

/**
 * The places drawn once on the document (`BO_0291_031`): after its last
 * block, what any extension has to say about the document as a whole — the
 * bibliography's reference list. Drawn in extension order; a tree holding no
 * such extension draws nothing there.
 */
export const DocumentDecorations = component$<{
  at: DocumentPlace;
  documentId: string;
  dataRevision?: number | undefined;
  form?: DocumentPlaceForm;
}>(({ at, documentId, dataRevision, form }) => (
  <>
    {sets().map(({ extension, decorations }) => {
      const Drawn = decorations.documentPlaces?.[at];
      if (Drawn === undefined) return null;
      const drawn = <Drawn key={`${extension}:${at}`} documentId={documentId} dataRevision={dataRevision} form={form} />;
      // The header's lines (DO_0030_001): each extension's contribution is a
      // row of its own, so one extension's lines never run into another's.
      return at === "title" && form !== "compact" ? (
        <div key={`${extension}:${at}`} class="document-title-place__row" data-title-place-row={extension}>
          {drawn}
        </div>
      ) : (
        drawn
      );
    })}
  </>
));
