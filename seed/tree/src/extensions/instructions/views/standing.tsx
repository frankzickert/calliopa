import { $, component$, createContextId, Slot, useContext, useContextProvider, useOnDocument, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import type { BlockDecorationProps, DecorationDrop, DocumentDecorationProps, DocumentPlaceProps } from "~/contract";
import { EditorSurfaceContext } from "~/extensions/documents/views/editor-surface";
import type { InstructionSummary } from "~/extensions/documents/lib/instruction";

import { InstructionToolsProvider } from "./tools";

/**
 * The instruction standing on a block or a document (`calliopa-bootstrap`'s
 * `BO_0349_030`–`BO_0349_032`): read once per document into this context,
 * drawn as a pill on the block while reading and under the document's title,
 * each with a × that takes it off; an instruction dragged out of the
 * *Structures* sheet and dropped on a block's middle or the header stands
 * there. Every write's answer is announced on the page, so the pills and the
 * chip read it at once.
 */

/** The kind an instruction dragged out of the *Structures* sheet carries. */
export const INSTRUCTION_DRAG_KIND = "instructions:instruction";

/** The event a write's answer is announced by. */
export const STANDING_CHANGED = "instruction-standing-changed";

interface Standing {
  readonly document: InstructionSummary | null;
  readonly blocks: Readonly<Record<string, InstructionSummary>>;
}

interface StandingState {
  documentId: string;
  standing: Standing | null;
  busy: boolean;
}

export const StandingContext = createContextId<StandingState>("instructions.standing");

const subjectPath = (documentId: string, blockId?: string): string =>
  `/api/x/instructions/documents/${encodeURIComponent(documentId)}${blockId === undefined ? "" : `/blocks/${encodeURIComponent(blockId)}`}/standing`;

function announce(documentId: string, standing: Standing, on: Document | null): void {
  const page = on ?? (typeof document === "undefined" ? null : document);
  if (page === null || typeof page.createEvent !== "function") return;
  const event = page.createEvent("Event");
  event.initEvent(STANDING_CHANGED, false, false);
  Object.defineProperty(event, "detail", { value: { documentId, standing } });
  page.dispatchEvent(event);
}

/** Stands an instruction on a block or the document, or takes it off with
 * null; the refusal in words, or null. The answer is handed to `apply` and
 * announced on the page `on` — the pressed control's own — for every other
 * pill and the chip. */
export async function postStanding(
  documentId: string,
  blockId: string | undefined,
  instruction: string | null,
  apply?: (standing: Standing) => void,
  on: Document | null = null,
): Promise<string | null> {
  const response = await fetch(subjectPath(documentId, blockId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ instruction }),
  }).catch(() => null);
  if (response === null) return "The server could not be reached.";
  const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as {
    outcome: string;
    result?: Standing;
    failures?: readonly { detail: string }[];
    error?: string;
  };
  if (response.ok && answer.outcome === "success" && answer.result !== undefined) {
    apply?.(answer.result);
    announce(documentId, answer.result, on);
    return null;
  }
  return answer.failures?.map((failure) => failure.detail).join(" ") ?? answer.error ?? `The server answered ${response.status}.`;
}

/** An instruction dropped from the sheet on a block's middle or the header
 * stands there (`BO_0349_011`). */
export const standDroppedInstruction = async (drop: DecorationDrop): Promise<string | null> =>
  // Between the rows an instruction means nothing: it stands on a block's
  // middle or the header alone. BO_0349_012
  drop.body === true ? null : postStanding(drop.documentId, drop.blockId, drop.itemId);

const StandingProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const surface = useContext(EditorSurfaceContext);
  const state = useStore<StandingState>({ documentId, standing: null, busy: false });
  useContextProvider(StandingContext, state);
  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    track(() => surface.loaded);
    state.documentId = id;
    const response = await fetch(subjectPath(id)).catch(() => null);
    const answer = response !== null && response.ok ? ((await response.json().catch(() => null)) as { outcome: string; result?: Standing } | null) : null;
    if (answer?.outcome === "success" && answer.result !== undefined) state.standing = answer.result;
  });
  useOnDocument(
    STANDING_CHANGED,
    $((event: Event) => {
      const detail = (event as CustomEvent<{ documentId: string; standing: Standing }>).detail;
      if (detail !== undefined && detail.documentId === state.documentId) state.standing = detail.standing;
    }),
  );
  return <Slot />;
});

/** `instructions`' one provider: the tools an instruction's code blocks are,
 * and what stands on the document and its blocks. */
export const InstructionsProvider = component$<DocumentDecorationProps>(({ documentId }) => (
  <InstructionToolsProvider documentId={documentId}>
    <StandingProvider documentId={documentId}>
      <Slot />
    </StandingProvider>
  </InstructionToolsProvider>
));

const StandingPill = component$<{ documentId: string; blockId?: string; instruction: InstructionSummary }>(({ documentId, blockId, instruction }) => {
  const state = useContext(StandingContext);
  const host = useSignal<HTMLElement>();
  const title = instruction.title.trim() === "" ? "Untitled instruction" : instruction.title;
  return (
    <span ref={host} class="instruction-standing" data-instruction-standing={instruction.id} title={`Commands here start with ${title}`}>
      <Icon name="compass" />
      <span class="instruction-standing__title">{title}</span>
      <button
        type="button"
        class="instruction-standing__clear"
        aria-label={`Take ${title} off`}
        data-instruction-standing-clear
        disabled={state.busy}
        preventdefault:mousedown
        onClick$={async () => {
          state.busy = true;
          await postStanding(
            documentId,
            blockId,
            null,
            (standing) => {
              state.standing = standing;
            },
            host.value?.ownerDocument ?? null,
          );
          state.busy = false;
        }}
      >
        <Icon name="x" />
      </button>
    </span>
  );
});

/** The pill on a block an instruction stands on (`BO_0349_032`). */
export const BlockStandingPill = component$<BlockDecorationProps>(({ documentId, blockId }) => {
  const state = useContext(StandingContext, null);
  const instruction = state?.standing?.blocks[blockId];
  return instruction === undefined ? null : <StandingPill documentId={documentId} blockId={blockId} instruction={instruction} />;
});

/**
 * The pill under the title of a document an instruction stands on. The
 * header's title rows stand outside the document's decoration provider, so
 * this reads what stands for itself and takes every write announced on the
 * page, as `structures`' title control does.
 */
export const DocumentStandingPill = component$<DocumentPlaceProps>(({ documentId, form }) => {
  const own = useStore<{ standing: Standing | null; busy: boolean; documentId: string }>({ standing: null, busy: false, documentId });
  useContextProvider(StandingContext, own);
  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    own.documentId = id;
    const response = await fetch(subjectPath(id)).catch(() => null);
    const answer = response !== null && response.ok ? ((await response.json().catch(() => null)) as { outcome: string; result?: Standing } | null) : null;
    if (answer?.outcome === "success" && answer.result !== undefined) own.standing = answer.result;
  });
  useOnDocument(
    STANDING_CHANGED,
    $((event: Event) => {
      const detail = (event as CustomEvent<{ documentId: string; standing: Standing }>).detail;
      if (detail !== undefined && detail.documentId === own.documentId) own.standing = detail.standing;
    }),
  );
  const instruction = own.standing?.document ?? null;
  return instruction === null || form === "compact" ? null : <StandingPill documentId={documentId} instruction={instruction} />;
});
