import { cutTitle, inlineChipName, revealTarget, type PointedReference, type RevealTarget } from "~/lib/command-target";
import { standingMark, type MarkLike } from "~/lib/command-typeahead";
import { markRefOf, type MarkRef } from "~/lib/runs";

import type { ReferenceChoice } from "./reference-choices";
import type { Marking } from "./references";

/**
 * What a prompt's reference is drawn as (`BO_0352_009`): its title by the
 * kind's rule, cut for the chip, and whether a mark still stands on what it
 * names. Pure, so every rule is settled without an editor.
 *
 * The title follows the kind (`DO_0041_Q3`): a block of this document as the
 * `#` list names it — a heading by its words, a figure, table, equation or
 * listing by its number, a paragraph by its label — else by the words it was
 * marked with; a passage by its words; another document, or a block or
 * passage in it, by that document's title; a proposal or a retired block by
 * its words, said to be one.
 */
export interface DrawnMark {
  /** The whole title, for the hover and the name. */
  readonly title: string;
  /** The title as the chip shows it, cut at a word. */
  readonly shown: string;
  /** The number it is told by: the standing mark's, else the one written. */
  readonly number: number;
  /** Whether a mark stands on what it names. */
  readonly standing: boolean;
  readonly name: string;
}

/** The titles the `#` list gives the document's blocks, by block, a
 * paragraph by its label or else its opening words. */
export function blockTitles(choices: readonly ReferenceChoice[]): Readonly<Record<string, string>> {
  const titles: Record<string, string> = {};
  for (const choice of choices) {
    titles[choice.blockId] = choice.label === "Paragraph" && choice.glimpse !== "" ? choice.glimpse : choice.label;
  }
  return titles;
}

/** A mark as a chip in the words is drawn against it: what it names, its
 * number, and the words and document title it was shown with. */
export type ShownMark = MarkLike & { readonly words?: string | undefined; readonly documentTitle?: string | undefined };

/** A prompt's stored marks as chips are drawn against them — a passage by its
 * anchored words — for a prompt other than the one being pointed from. */
export function marksOf(marking: Marking): ShownMark[] {
  return marking.references.map((reference): ShownMark => ({
    number: reference.number,
    kind: reference.kind,
    document: reference.document,
    blockId: reference.blockId,
    ...(reference.kind === "passage" ? { quote: reference.anchor.quote } : {}),
    target: reference.target,
    ...(reference.kind === "proposal" ? { group: reference.group } : { group: "group" in reference ? reference.group : undefined, item: "item" in reference ? reference.item : undefined }),
    words: "words" in reference ? reference.words : undefined,
    documentTitle: reference.documentTitle,
  }));
}

export function markTitle(
  reference: MarkRef,
  standing: ShownMark | undefined,
  blocks: Readonly<Record<string, string>>,
): string {
  const words = (reference.words ?? standing?.words ?? "").trim();
  if (reference.kind === "document" || reference.document !== undefined) {
    // A reference into another document is written with that document's
    // title as its words (`command-control.tsx`), so it is told without a
    // standing mark too.
    return (standing?.documentTitle ?? "").trim() || words || (reference.document ?? "");
  }
  if (reference.kind === "proposal" || reference.target === "proposal") {
    return `${words || "Proposal"} (proposed)`;
  }
  if (reference.target === "retired") return `${words || "Block"} (retired)`;
  if (reference.kind === "passage") return (reference.quote ?? words).trim();
  const block = reference.blockId === undefined ? undefined : blocks[reference.blockId];
  return block ?? words;
}

/**
 * A prompt's reference as its chip draws it, against the prompt's marks —
 * or, for a prompt whose marks this page has not read, against what its words
 * name, which is what its marks come back as (`BO_0352_013`), so it stands.
 */
export function drawnMark(
  reference: MarkRef,
  references: readonly ShownMark[] | null,
  blocks: Readonly<Record<string, string>>,
): DrawnMark {
  const standing = references === null ? reference : standingMark(reference, references);
  const title = markTitle(reference, standing, blocks) || `#${reference.number}`;
  const number = standing?.number ?? reference.number;
  return {
    title,
    shown: standing === undefined ? `#${reference.number}` : cutTitle(title),
    number,
    standing: standing !== undefined,
    name: inlineChipName(number, title, standing !== undefined),
  };
}

/**
 * The atom a mark is written as when it is chosen from a prompt's `#` list
 * (`BO_0352_010`): what the shell sends of it, and the words it is told
 * without the device — a block's or passage's opening, or, pointing into
 * another document, that document's title.
 */
export function markRefFrom(reference: PointedReference): MarkRef {
  const words = (reference.document !== undefined || reference.kind === "document" ? reference.documentTitle : undefined) ?? reference.words;
  return markRefOf({
    number: reference.number,
    kind: reference.kind,
    ...(reference.blockId !== undefined ? { blockId: reference.blockId } : {}),
    ...(reference.kind === "passage" ? { quote: reference.quote } : {}),
    ...(reference.document !== undefined ? { document: reference.document } : {}),
    ...(reference.target !== undefined ? { target: reference.target } : {}),
    ...(reference.group !== undefined ? { group: reference.group } : {}),
    ...(reference.item !== undefined ? { item: reference.item } : {}),
    ...(reference.kind === "proposal" ? { items: reference.items } : {}),
    ...(reference.revisionId !== undefined ? { revisionId: reference.revisionId } : {}),
    ...(words !== undefined && words.trim() !== "" ? { words: words.trim() } : {}),
  });
}

/**
 * The marks a prompt's chips are drawn against: the report while it is the
 * prompt pointed from, its marks as this page holds them otherwise, and null
 * for a prompt whose marks this page has not read. BO_0352_011
 */
export function promptMarks(
  store: { readonly prompt: string | null; readonly byPrompt: Readonly<Record<string, Marking>>; readonly report: { readonly references: readonly PointedReference[] } },
  blockId: string,
): readonly ShownMark[] | null {
  if (store.prompt === blockId) return store.report.references;
  const held = store.byPrompt[blockId];
  return held === undefined ? null : marksOf(held);
}

/**
 * What pressing a chip in the words asks to be shown (`BO_0352_012`): what it
 * names, as the command line's chip asks for it — or nothing for a chip no
 * mark stands on, whose target may have gone.
 */
export function markReveal(reference: MarkRef, drawn: DrawnMark): RevealTarget | null {
  if (!drawn.standing) return null;
  const shown = {
    ...reference,
    number: drawn.number,
    words: reference.words ?? "",
    stale: false,
    ...(reference.document !== undefined && reference.words !== undefined ? { documentTitle: reference.words } : {}),
  } as PointedReference;
  return revealTarget(shown);
}
