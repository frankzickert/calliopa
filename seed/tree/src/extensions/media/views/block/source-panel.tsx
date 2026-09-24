import { $, component$, useSignal } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";
import type { MadeBy } from "../../server/source";

/**
 * What made this picture (`BO_0273_019`).
 *
 * Hidden while the reader is not at the block and shown when they turn to it,
 * the way a proposal's chip behaves — the reading surface shows no machinery
 * of its own. **It is read only when it is shown**, so a document full of
 * pictures costs nothing to read.
 *
 * *Try again* is a fresh press and a fresh cost: it makes the same picture
 * again from the same words, and says so before it does.
 */
export const SourcePanel = component$<BlockDecorationProps>(({ documentId, blockId }) => {
  const made = useSignal<MadeBy | null>(null);
  const open = useSignal(false);
  const note = useSignal<string | null>(null);

  const show$ = $(async () => {
    open.value = true;
    if (made.value !== null) return;
    const answer = await fetch(
      `/api/x/media/source?documentId=${encodeURIComponent(documentId)}&blockId=${encodeURIComponent(blockId)}`,
    );
    if (!answer.ok) return;
    made.value = (await answer.json()) as MadeBy | null;
  });

  const again$ = $(async () => {
    note.value = "Making it again…";
    const answer = await fetch("/api/x/media/remake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, blockId }),
    });
    note.value = answer.ok
      ? null
      : ((await answer.json()) as { error?: string }).error ?? "It could not be made again.";
  });

  return (
    <div
      class="media-source"
      data-media-source={blockId}
      data-media-source-open={String(open.value)}
      onMouseEnter$={show$}
      onFocusIn$={show$}
      onMouseLeave$={() => (open.value = false)}
    >
      {open.value && made.value !== null && (
        <dl class="media-source__made" data-media-made>
          {made.value.model !== undefined && (
            <>
              <dt>Made by</dt>
              <dd data-media-made-model>
                {made.value.service ?? ""} {made.value.model}
              </dd>
            </>
          )}
          {made.value.cost !== undefined && (
            <>
              <dt>Cost</dt>
              <dd data-media-made-cost>{made.value.cost}</dd>
            </>
          )}
          {made.value.at !== undefined && (
            <>
              <dt>When</dt>
              <dd data-media-made-at>{made.value.at}</dd>
            </>
          )}
          {made.value.prompt !== undefined && (
            <>
              <dt>From</dt>
              <dd data-media-made-prompt>{made.value.prompt}</dd>
            </>
          )}
          <dd>
            <button type="button" data-media-again onClick$={again$}>
              Try again — a fresh cost
            </button>
          </dd>
          {note.value !== null && <dd data-media-again-note>{note.value}</dd>}
        </dl>
      )}
    </div>
  );
});
