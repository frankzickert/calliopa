import { isAtom, type Run } from "~/lib/runs";

/**
 * Inline annotations (`BO_0301_015`): what an extension has to say about a
 * range of a block's words while they are read — a keyword's mention — drawn
 * by the editor over the runs and stored nowhere. The runs under an
 * annotation are untouched: the editor splits them at the annotation's
 * edges only to draw, and reads them back whole, since the wrapper carries
 * no mark. Offsets are the run model's: characters, an atom one wide.
 */
export interface Annotation {
  readonly start: number;
  readonly end: number;
  /** What kind of thing annotates — the extension's word, `keyword`. */
  readonly kind: string;
  /** What it points at, for the extension that drew it to act on. */
  readonly id: string;
  /** Its name, said on the wrapper for a reader and a tooltip. */
  readonly title: string;
  /** What a hover may show of it, in words. */
  readonly detail?: string;
}

/** One piece of a run, and the annotation over it, if any. */
export interface Segment {
  readonly run: Run;
  readonly annotation: Annotation | null;
}

const piece = (run: Run, text: string): Run => ({ ...run, text });

/**
 * The runs cut at the annotations' edges, each piece carrying the annotation
 * over it. Annotations are taken in order of start; one overlapping the
 * previous is dropped, and an atom is never cut — it is annotated whole
 * when an annotation covers it.
 */
export function annotate(runs: readonly Run[], annotations: readonly Annotation[]): Segment[] {
  const ordered = [...annotations]
    .filter((annotation) => annotation.end > annotation.start)
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const kept: Annotation[] = [];
  for (const annotation of ordered) {
    const last = kept[kept.length - 1];
    if (last !== undefined && annotation.start < last.end) continue;
    kept.push(annotation);
  }
  if (kept.length === 0) return runs.map((run) => ({ run, annotation: null }));

  const segments: Segment[] = [];
  let offset = 0;
  let next = 0;
  const covering = (at: number): Annotation | null => {
    while (next < kept.length && (kept[next] as Annotation).end <= at) next += 1;
    const candidate = kept[next];
    return candidate !== undefined && candidate.start <= at ? candidate : null;
  };
  for (const run of runs) {
    if (isAtom(run)) {
      segments.push({ run, annotation: covering(offset) });
      offset += 1;
      continue;
    }
    const chars = [...run.text];
    let from = 0;
    while (from < chars.length) {
      const at = offset + from;
      const annotation = covering(at);
      // The piece runs to the annotation's edge, or to the next one's start.
      const upcoming = kept[next];
      const edge = annotation !== null ? annotation.end : upcoming === undefined ? Number.POSITIVE_INFINITY : upcoming.start;
      const to = Math.min(chars.length, edge - offset);
      const length = Math.max(1, to - from);
      segments.push({ run: piece(run, chars.slice(from, from + length).join("")), annotation });
      from += length;
    }
    offset += chars.length;
  }
  return segments;
}
