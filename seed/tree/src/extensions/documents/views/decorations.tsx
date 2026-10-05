import { component$, Slot, useContext, type JSXOutput, type QRL } from "@builder.io/qwik";

import { optionsOf, ViewBridgeContext } from "~/components/shell/view-bridge";

import { REGISTRY } from "~/registry.gen";
import type { BlockPlace, DecorationDrop, Decorations, DocumentPlace, DocumentPlaceForm, NestedBlock } from "~/contract";

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
  setOption$?: QRL<(name: string, value: string | null, once?: boolean) => void>;
  /** The `nested` place's: the block just nested, and how the place says it
   * is finished. BO_0349_010 */
  nested?: NestedBlock;
  done$?: QRL<() => void>;
}>(({ at, documentId, blockId, revisionId, active, setOption$, nested, done$ }) => {
  // The `command` place reads the options set on its command, read here
  // rather than by the chip, so a choice re-draws the places alone and not
  // the command it stands in. BO_0336_051
  const bridge = useContext(ViewBridgeContext, null);
  const commandOptions = at === "command" && bridge !== null ? optionsOf(bridge.commandOptions, documentId, blockId) : undefined;
  return (
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
          {...(commandOptions === undefined ? {} : { commandOptions })}
          {...(nested === undefined ? {} : { nested })}
          {...(done$ === undefined ? {} : { done$ })}
        />
      );
    })}
  </>
  );
});

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

/**
 * A drop of an item another extension knows — a structure or an instruction
 * dragged out of the library — on a block or the header (`BO_0349_011`): the
 * first extension declaring the item's kind says what it means, and its
 * refusal, or null. An item no extension knows means nothing here.
 */
export async function dropOnDocument(
  payload: { readonly itemId: string; readonly kind: string },
  documentId: string,
  blockId: string | null,
  startRun?: DecorationDrop["startRun"],
  body = false,
  passage: DecorationDrop["passage"] | null = null,
): Promise<string | null> {
  const handler = sets()
    .map(({ decorations }) => decorations.drops?.[payload.kind])
    .find((candidate) => candidate !== undefined);
  if (handler === undefined) return null;
  return handler({
    itemId: payload.itemId,
    documentId,
    ...(blockId === null ? {} : { blockId }),
    ...(body ? { body: true as const } : {}),
    ...(passage === null || passage === undefined ? {} : { passage }),
    ...(startRun === undefined ? {} : { startRun }),
  });
}

/** Whether a dragged kind starts work on the body between the rows, as an
 * extension declares in `drops.onBody`, so the body lights red only for it
 * (`BO_0349_012`). */
export const actsOnBody = (kind: string): boolean =>
  sets().some(({ decorations }) => decorations.actsOnBody?.includes(kind) === true);

