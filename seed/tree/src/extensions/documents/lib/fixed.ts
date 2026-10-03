/**
 * What another extension fixes on a document (`structures`' `RO_0005_020`):
 * a document never deleted, a title the release keeps, blocks that stay in
 * the document. This extension knows no meaning behind any of it; an
 * extension depending on it registers a guard, and every act that would
 * delete the document, change its title or take a block out of it — a
 * person's, and a run's at its acceptance — asks the guards first and is
 * refused in the words they give. The document read answers the same, so
 * the editor draws a fixed title fixed and offers no *Delete*.
 */
export interface Fixed {
  /** Why the document is never deleted; absent when it may be. */
  readonly undeletable?: string;
  /** Why its title is not changed; absent when it may be. */
  readonly title?: string;
  /** Per block id: why the block stays in this document. Its words stay
   * editable; it is never retired, merged into another, turned into another
   * kind or moved out. */
  readonly blocks: Readonly<Record<string, string>>;
}

/** Several guards' answers as one: the first reason given for each. */
export function mergeFixed(answers: readonly Fixed[]): Fixed {
  let undeletable: string | undefined;
  let title: string | undefined;
  const blocks: Record<string, string> = {};
  for (const answer of answers) {
    undeletable ??= answer.undeletable;
    title ??= answer.title;
    for (const [blockId, reason] of Object.entries(answer.blocks)) blocks[blockId] ??= reason;
  }
  return {
    ...(undeletable === undefined ? {} : { undeletable }),
    ...(title === undefined ? {} : { title }),
    blocks,
  };
}

/** The first of these blocks a guard keeps in the document, with its
 * reason, or null when none is kept. */
export function firstFixed(fixed: Fixed, blockIds: Iterable<string>): { readonly blockId: string; readonly reason: string } | null {
  for (const blockId of blockIds) {
    const reason = fixed.blocks[blockId];
    if (reason !== undefined) return { blockId, reason };
  }
  return null;
}
