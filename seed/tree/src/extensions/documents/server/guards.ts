import type { GraphOutcome } from "~/server/outcome";

import { mergeFixed, type Fixed } from "../lib/fixed";

/**
 * The guards other extensions register on documents (`structures`' `RO_0005_020`):
 * what each fixes is `lib/fixed.ts`'s `Fixed`. Every act that would delete a
 * document, change its title or take a block out of it asks `fixedOf` first.
 */

/** A guard: what it fixes on one document, read in the caller's scope. */
export type DocumentGuard = (documentId: string) => Promise<GraphOutcome<Fixed>>;

export { firstFixed, mergeFixed, type Fixed } from "../lib/fixed";

const NOTHING_FIXED: Fixed = { blocks: {} };

const guards = new Map<string, DocumentGuard>();

/**
 * Registers an extension's guard under its name, replacing one registered
 * under the same name before. Called once, when the extension's server
 * module loads.
 */
export function guardDocuments(name: string, guard: DocumentGuard): void {
  guards.set(name, guard);
}

/**
 * What the registered guards fix on a document. A guard that cannot answer
 * fails the read, so an act it would refuse is never let through unasked.
 */
export async function fixedOf(documentId: string): Promise<GraphOutcome<Fixed>> {
  if (guards.size === 0) return { outcome: "success", result: NOTHING_FIXED };
  const answers: Fixed[] = [];
  for (const guard of guards.values()) {
    const answer = await guard(documentId);
    if (answer.outcome !== "success") return answer;
    answers.push(answer.result);
  }
  return { outcome: "success", result: mergeFixed(answers) };
}

/**
 * What a document is, as an extension names it (`DO_0034_002`): a word — a
 * *structure* — for a document id, read through the group when one is given,
 * or nothing. A run chip names a document the run started by it; a document
 * no extension names is a document.
 */
export type DocumentNamer = (documentId: string, group?: string) => Promise<string | undefined>;

const namers = new Map<string, DocumentNamer>();

/** Registers an extension's namer under its name, as `guardDocuments` does. */
export function nameDocuments(name: string, namer: DocumentNamer): void {
  namers.set(name, namer);
}

/** The first word a registered namer gives the document, or nothing. */
export async function kindOfDocument(documentId: string, group?: string): Promise<string | undefined> {
  for (const namer of namers.values()) {
    const kind = await namer(documentId, group).catch(() => undefined);
    if (kind !== undefined && kind !== "") return kind;
  }
  return undefined;
}

/**
 * What an extension names every document it names, for the whole listing at
 * once (`DO_0042_002`): each document id with its word, in one read — never
 * a read per document, which `DocumentNamer` is for.
 */
export type DocumentLister = () => Promise<ReadonlyMap<string, string>>;

const listers = new Map<string, DocumentLister>();

/** Registers an extension's lister under its name, as `nameDocuments` does. */
export function nameListedDocuments(name: string, lister: DocumentLister): void {
  listers.set(name, lister);
}

/**
 * The word the registered listers give each document they name, the first
 * lister's word winning. A lister that fails names nothing, and the listing
 * still answers.
 */
export async function namesOfDocuments(): Promise<ReadonlyMap<string, string>> {
  const names = new Map<string, string>();
  for (const lister of listers.values()) {
    const named = await lister().catch(() => new Map<string, string>());
    for (const [documentId, word] of named) if (word !== "" && !names.has(documentId)) names.set(documentId, word);
  }
  return names;
}
