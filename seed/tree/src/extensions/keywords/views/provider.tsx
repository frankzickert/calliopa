import { $, component$, Slot, useContext, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { DocumentDecorationProps } from "~/contract";
import type { Annotation } from "~/extensions/documents/lib/annotations";
import { EditorSurfaceContext } from "~/extensions/documents/views/editor-surface";
import { InlineAnnotationsContext } from "~/extensions/documents/views/inline-annotations";

import { definitionText, type DocumentMentionsView } from "../lib/keywords";
import "./keywords.css";

/**
 * The mentions a document's editor draws (`BO_0301_015`): read once per
 * document from this extension's route and again whenever the editor reads
 * the document again, written into the editor's inline annotations as this
 * extension's source — each mention with the keyword's title and its
 * definition for the hover — and a press on one opens the keyword document
 * in a tab. With nothing answered, or the extension unreachable, nothing is
 * written and nothing is drawn.
 */
export const SOURCE = "keywords";
export const KIND = "keyword";

type Answer = { outcome?: string; result?: DocumentMentionsView };

const isView = (value: unknown): value is DocumentMentionsView =>
  typeof value === "object" && value !== null && Array.isArray((value as DocumentMentionsView).blocks) && typeof (value as DocumentMentionsView).keywords === "object";

/** The editor's annotations from a read, by block. */
export function annotationsOf(view: DocumentMentionsView): Record<string, Annotation[]> {
  const byBlock: Record<string, Annotation[]> = {};
  for (const block of view.blocks) {
    byBlock[block.blockId] = block.mentions.flatMap((mention) => {
      const keyword = view.keywords[mention.keyword];
      if (keyword === undefined) return [];
      const detail = definitionText(keyword.definition);
      return [
        {
          start: mention.start,
          end: mention.end,
          kind: KIND,
          id: keyword.id,
          title: keyword.title,
          ...(detail === "" ? {} : { detail }),
        },
      ];
    });
  }
  return byBlock;
}

export const KeywordsProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const bridge = useContext(ViewBridgeContext);
  const surface = useContext(EditorSurfaceContext);
  const annotations = useContext(InlineAnnotationsContext, null);

  const read$ = $(async (id: string) => {
    if (annotations === null || id === "") return;
    const response = await fetch(`/api/x/keywords/documents/${encodeURIComponent(id)}`).catch(() => null);
    if (response === null || !response.ok) return;
    const answer = (await response.json().catch(() => null)) as Answer | null;
    if (answer?.outcome !== "success" || !isView(answer.result)) return;
    annotations.sources = { ...annotations.sources, [SOURCE]: annotationsOf(answer.result) };
    annotations.version += 1;
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the mentions are read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    track(() => surface.loaded);
    await read$(id);
  });

  // A press on a mention is this extension's (`BO_0301_015`): the editor
  // records it and opens no editor; the keyword opens in a tab.
  useTask$(({ track }) => {
    const pressed = track(() => annotations?.pressed ?? null);
    if (pressed === null || pressed.kind !== KIND) return;
    void bridge.openTarget$({ kind: "documents:document", itemId: pressed.id, title: pressed.title });
  });

  return <Slot />;
});
