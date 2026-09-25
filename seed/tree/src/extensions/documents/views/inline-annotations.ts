import { createContextId } from "@builder.io/qwik";

import type { Annotation } from "../lib/annotations";

/**
 * The inline annotations the editor draws over a block's words while it is
 * read (`BO_0301_015`), by the extension that annotates and then by block:
 * a decoration provider mounted around the document writes its own source
 * and bumps `version`, the reading rows draw every source's annotations
 * over their runs, and the editor stores nothing of it. An extension's
 * source replaces its own and leaves the others' — the keyword mention is
 * the first.
 */
export interface InlineAnnotations {
  sources: Record<string, Readonly<Record<string, readonly Annotation[]>>>;
  version: number;
  /** The annotation last pressed while reading, for the extension that drew
   * it to act on — the editor opens no editor for the press. `at` moves on
   * every press, so the same annotation pressed twice is seen twice. */
  pressed: { readonly kind: string; readonly id: string; readonly title: string; readonly at: number } | null;
}

export const InlineAnnotationsContext = createContextId<InlineAnnotations>("documents.inline-annotations");

/** Every source's annotations on one block, in order of start. */
export function annotationsOn(annotations: InlineAnnotations | null, blockId: string): Annotation[] {
  if (annotations === null) return [];
  const found: Annotation[] = [];
  for (const source of Object.keys(annotations.sources)) {
    const byBlock = annotations.sources[source];
    const here = byBlock?.[blockId];
    if (here !== undefined) found.push(...here);
  }
  return found.sort((left, right) => left.start - right.start);
}
