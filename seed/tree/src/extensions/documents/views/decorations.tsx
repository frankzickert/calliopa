import { component$, Slot, type JSXOutput } from "@builder.io/qwik";

import { REGISTRY } from "~/registry.gen";
import type { BlockPlace, Decorations, DocumentPlace } from "~/contract";

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

export const BlockDecorations = component$<{
  at: BlockPlace;
  documentId: string;
  blockId: string;
  revisionId: string;
  active: boolean;
}>(({ at, documentId, blockId, revisionId, active }) => (
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
}>(({ at, documentId, dataRevision }) => (
  <>
    {sets().map(({ extension, decorations }) => {
      const Drawn = decorations.documentPlaces?.[at];
      return Drawn === undefined ? null : (
        <Drawn key={`${extension}:${at}`} documentId={documentId} dataRevision={dataRevision} />
      );
    })}
  </>
));
