import type { Run } from "~/lib/runs";

/**
 * Typesetting in the browser, for the block being edited (`BO_0290_027`).
 *
 * Reading a document needs none of this: the server sets every equation as it
 * reads it, and the markup arrives with the block. Editing is the one place
 * that cannot wait for a round trip — an equation typed a moment ago, or one
 * just changed in its popover, has no markup from anywhere — and it is also
 * the one place already paying for the engine, since the popover's preview
 * loads it.
 *
 * So this holds what the editing surface has typeset, keyed by source, and
 * fills it in as sources appear. Until one is ready its run draws as its own
 * source, which is what an equation nothing can set looks like anyway.
 */
const known = new Map<string, string>();
let engine: typeof import("../lib/mathjax") | null = null;
let loading: Promise<void> | null = null;

/** What the surface has ready, for `paintRuns`. */
export const typesetInline = (tex: string): string | undefined => known.get(tex);

/** Every math run whose source nothing has set yet. */
const unset = (runs: readonly Run[]): string[] => {
  const wanted = new Set<string>();
  for (const run of runs) {
    if (run.math === true && run.text !== "" && !known.has(run.text)) wanted.add(run.text);
  }
  return [...wanted];
};

/**
 * Sets whatever in these runs has no markup yet, and answers whether anything
 * became ready — so the caller repaints once, rather than on a timer.
 *
 * The engine arrives through the same lazy import the popover uses, so it is
 * fetched once per session and only by someone editing.
 */
export async function typesetMissing(
  runs: readonly Run[],
  seed: Readonly<Record<string, string>> = {},
): Promise<boolean> {
  // What the read already set is the surface's too: it never typesets again
  // what arrived typeset.
  let added = false;
  for (const [source, markup] of Object.entries(seed)) {
    if (!known.has(source)) {
      known.set(source, markup);
      added = true;
    }
  }
  const wanted = unset(runs);
  if (wanted.length === 0) return added;
  if (engine === null) {
    loading = loading ?? import("../lib/mathjax").then((module) => {
      engine = module;
    });
    await loading;
  }
  if (engine === null) return added;
  for (const source of wanted) {
    const outcome = engine.typeset(source, false);
    if (engine.isTypeset(outcome)) {
      known.set(source, outcome.svg);
      added = true;
    }
  }
  return added;
}
