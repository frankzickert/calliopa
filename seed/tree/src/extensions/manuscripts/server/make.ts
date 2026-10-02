import type { DocumentView } from "~/extensions/documents/server/assemble";
import type { WorkRecord } from "~/extensions/bibliography/lib/work";
import { readWork } from "~/extensions/bibliography/server/works";
import { mentionsOf } from "~/extensions/keywords/server/keywords";
import { blobHash, blobReference, readBlob } from "~/server/ccgw/blobs";

import { RENDITION_TYPE, type Outcome, type RenditionType } from "../lib/rendition";
import type { GlossaryEntry, Projection } from "./project";

/**
 * What a rendition is made of (`BO_0293_021`, `calliopa-bootstrap`'s
 * `BO_0312_021`): the works a document cites, read from the bibliography, the
 * projection's figures read from the store, the glossary, and the one write
 * that keeps a rendition. Only a run makes one now, through the kernel's
 * `make_manuscript`: the person's press and the bar it stood in are gone, and
 * a profile the person writes is what asks for a manuscript (`BO_0312_Q1`).
 */

/** The works a document cites, by identity, as the bibliography holds them. */
export async function citedWorks(document: DocumentView): Promise<Map<string, WorkRecord>> {
  const ids = new Set<string>();
  for (const block of document.blocks) {
    if (block.kind !== "text") continue;
    for (const run of block.runs) if (run.cite !== undefined) ids.add(run.cite.work);
  }
  const works = new Map<string, WorkRecord>();
  for (const id of ids) {
    const read = await readWork(id);
    if (read.outcome === "success") works.set(id, read.result.record);
  }
  return works;
}

/**
 * The projection's figures read from the store: base64 as the service takes
 * them, and as blob references with the names the source includes them by,
 * kept beside the source so the LaTeX a person downloads typesets by hand
 * and a venue takes it whole (found by the walk, 2026-09-25: an IEEE source
 * typeset again by hand stopped at its missing picture). No new bytes: each
 * reference is the block's own blob. Shared by a press and a run's
 * manuscript (`BO_0293_023`).
 */
export async function figuresOf(projection: Projection): Promise<{ readonly files: Record<string, string>; readonly kept: Record<string, unknown>[] } | { readonly failure: string }> {
  const files: Record<string, string> = {};
  const kept: Record<string, unknown>[] = [];
  for (const file of projection.files) {
    try {
      const bytes = await readBlob(blobHash(file.objectId));
      files[file.name] = Buffer.from(bytes).toString("base64");
      kept.push({ ...blobReference(file.objectId, file.mediaType, bytes.byteLength), filename: file.name });
    } catch {
      return { failure: `the picture ${file.name} could not be read from the store` };
    }
  }
  return { files, kept };
}

/**
 * The glossary a manuscript carries (`BO_0301_020`): every keyword the
 * document mentions at its revision, read through the keywords extension's
 * own module under the declared dependency, each with its definition. A
 * read that does not answer — the extension switched off, no keyword role
 * chosen — is no glossary, and the manuscript says nothing about one.
 */
export async function glossaryOf(document: DocumentView): Promise<GlossaryEntry[]> {
  try {
    const read = await mentionsOf(document.documentId, document.dataRevision === undefined ? {} : { dataRevision: document.dataRevision });
    if (read.outcome !== "success") return [];
    return Object.values(read.result.keywords).map((keyword) => ({ title: keyword.title, definition: keyword.definition }));
  } catch {
    return [];
  }
}

/** What a kept rendition is made of, as one `formatRendition` node. */
export interface RenditionFacts {
  readonly renditionId: string;
  /** The document carrying Format (`BO_0332`); a block's id only on one
   * kept on a block before. */
  readonly of: string;
  readonly documentId: string;
  readonly type: RenditionType;
  readonly title: string;
  readonly revision: number;
  readonly venue: string;
  readonly files: readonly Record<string, unknown>[];
  readonly made: string;
  readonly by: string;
  readonly outcome: Outcome;
  readonly log: readonly string[];
  readonly omitted: readonly string[];
}

/**
 * The one write that keeps a rendition: a run's `make_manuscript` has the
 * kernel stage it into the run's group (`BO_0293_023`) with no status, since
 * a proposal-scoped write stages a candidate and refuses an explicit
 * `established` (found by the instance check, 2026-09-25).
 */
export function renditionWrite(facts: RenditionFacts): { readonly statement: string; readonly parameters: Record<string, unknown> } {
  return {
    statement: `CREATE (r:${RENDITION_TYPE} {id: $r_id, of: $r_of, document: $r_document, type: $r_type, title: $r_title, revision: $r_revision, venue: $r_venue, files: $r_files, made: $r_made, by: $r_by, outcome: $r_outcome, log: $r_log, omitted: $r_omitted})`,
    parameters: {
      r_id: facts.renditionId,
      r_of: facts.of,
      r_document: facts.documentId,
      r_type: facts.type,
      r_title: facts.title,
      r_revision: facts.revision,
      r_venue: facts.venue,
      r_files: facts.files,
      r_made: facts.made,
      r_by: facts.by,
      r_outcome: facts.outcome,
      r_log: facts.log,
      r_omitted: facts.omitted,
    },
  };
}
