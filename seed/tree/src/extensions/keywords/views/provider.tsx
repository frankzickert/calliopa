import { $, component$, Slot, useContext, useSignal, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { DocumentDecorationProps } from "~/contract";
import type { Annotation } from "~/extensions/documents/lib/annotations";
import type { TriggerEntry } from "~/extensions/documents/lib/inline-triggers";
import { EditorSurfaceContext } from "~/extensions/documents/views/editor-surface";
import { InlineAnnotationsContext } from "~/extensions/documents/views/inline-annotations";
import { InlineTriggersContext } from "~/extensions/documents/views/inline-triggers";
import type { Run } from "~/lib/runs";

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
/** A keyword named with `@` whose document is gone: drawn, and a press on it
 * opens nothing. BO_0310_023 */
export const GONE_KIND = "keyword-gone";

/** What the `@` list is handed: every keyword with its aliases. */
interface Listed {
  readonly id: string;
  readonly title: string;
  readonly aliases: readonly string[];
}

/** A keyword as the `@` list offers it: by its title, found by any name. */
export const entryOf = (keyword: Listed): TriggerEntry => ({
  id: keyword.id,
  label: keyword.title,
  names: [keyword.title, ...keyword.aliases],
  ...(keyword.aliases.length === 0 ? {} : { detail: keyword.aliases.join(", ") }),
});

type Answer = { outcome?: string; result?: DocumentMentionsView };

const isView = (value: unknown): value is DocumentMentionsView =>
  typeof value === "object" && value !== null && Array.isArray((value as DocumentMentionsView).blocks) && typeof (value as DocumentMentionsView).keywords === "object";

/** The editor's annotations from a read, by block. */
export function annotationsOf(view: DocumentMentionsView): Record<string, Annotation[]> {
  const byBlock: Record<string, Annotation[]> = {};
  for (const block of view.blocks) {
    byBlock[block.blockId] = block.mentions.flatMap((mention) => {
      const keyword = view.keywords[mention.keyword];
      if (keyword === undefined) {
        // Named with `@`, and no keyword any more. BO_0310_023
        const title = view.notKeywords?.[mention.keyword];
        if (title === undefined) return [];
        return [
          title === ""
            ? { start: mention.start, end: mention.end, kind: GONE_KIND, id: mention.keyword, title: "Not a keyword", detail: "The keyword's document is gone." }
            : { start: mention.start, end: mention.end, kind: KIND, id: mention.keyword, title, detail: "Not a keyword: the document no longer carries Keyword." },
        ];
      }
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
  const triggers = useContext(InlineTriggersContext, null);

  /** Bumped when a keyword is created from the `@` list, so the list is read
   * again with it. */
  const created = useSignal(0);

  // A keyword named on purpose: its title as the words, its identity on the
  // run. BO_0310_024
  const run$ = $((entry: TriggerEntry): Run => ({ text: entry.label, keyword: entry.id }));

  /** *Create keyword "…"*: the document titled with what was typed, taking
   * Keyword, made by this extension's route; a refusal in its words. */
  const create$ = $(async (typed: string): Promise<TriggerEntry | { readonly failure: string }> => {
    const made = await fetch("/api/x/keywords/keywords", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: typed }),
    }).catch(() => null);
    const body = (await made?.json().catch(() => null)) as
      | { outcome?: string; result?: Listed; detail?: string; error?: string; failures?: readonly { detail: string }[] }
      | null;
    if (made === null || !made.ok || body?.outcome !== "success" || body.result === undefined)
      return { failure: body?.failures?.map((failure) => failure.detail).join(" ") ?? body?.detail ?? body?.error ?? "The keyword was not created." };
    created.value += 1;
    return entryOf(body.result);
  });

  /** The keywords the `@` list offers, registered as this extension's inline
   * trigger. */
  const list$ = $(async () => {
    if (triggers === null) return;
    const response = await fetch("/api/x/keywords/keywords").catch(() => null);
    if (response === null || !response.ok) return;
    const answer = (await response.json().catch(() => null)) as { outcome?: string; result?: readonly Listed[] } | null;
    if (answer?.outcome !== "success" || !Array.isArray(answer.result)) return;
    triggers.triggers = {
      ...triggers.triggers,
      [SOURCE]: { character: "@", entries: answer.result.map(entryOf), createLabel: "Create keyword", run$, create$ },
    };
    triggers.version += 1;
  });

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
    track(() => created.value);
    await Promise.all([read$(id), list$()]);
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
