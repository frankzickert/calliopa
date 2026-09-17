import { component$, Slot } from "@builder.io/qwik";

import { REGISTRY } from "~/registry.gen";
import type { BlockPlace } from "~/contract";

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
 * The contributed provider, wrapped around the document's blocks so a
 * decoration set reads the document once and shares it through its own
 * context rather than fetching per block. At most one extension provides for
 * a kind — the registry refuses a second by name — so this is one optional
 * wrapper and not a nest; a second decorating extension is a change that
 * makes it one.
 */
export const DecorationProvider = component$<{ documentId: string }>(
  ({ documentId }) => {
    const Provider = sets().find((set) => set.decorations.provider !== undefined)
      ?.decorations.provider;
    return Provider === undefined ? (
      <Slot />
    ) : (
      <Provider documentId={documentId}>
        <Slot />
      </Provider>
    );
  },
);
