/**
 * A reference-list entry as segments (`BO_0291_027`), so a container or a
 * book's title is set in italics without the entry carrying markup.
 */
export interface Segment {
  readonly text: string;
  readonly italic?: true;
}

export const entryText = (segments: readonly Segment[]): string => segments.map((segment) => segment.text).join("");
