import { randomUUID } from "node:crypto";

import type { DocumentView } from "~/extensions/documents/server/assemble";
import { readDocument } from "~/extensions/documents/server/documents";
import type { WorkRecord } from "~/extensions/bibliography/lib/work";
import { readWork } from "~/extensions/bibliography/server/works";
import { mentionsOf } from "~/extensions/keywords/server/keywords";
import { blobHash, blobReference, objectIdOfHash, putBlob, readBlob } from "~/server/ccgw/blobs";
import { commit } from "~/server/ccgw/script";
import { call } from "~/server/kernel/client";
import type { GraphOutcome } from "~/server/outcome";

import { MANUSCRIPT_TYPE, isOutcome, type Outcome, type Venue } from "../lib/manuscript";
import { project, type GlossaryEntry, type Projection } from "./project";

/**
 * A manuscript made and kept (`BO_0293_021`): the document read, its cited
 * works read from the bibliography, the projection sent with the figures'
 * bytes to the typesetting service through the kernel forward, and what came
 * back kept — the LaTeX source, its `.bib` and the PDF as blobs, and one
 * `manuscript` node naming the document, the dataRevision projected, the
 * venue, when, by whom, the outcome, the log and what was left out. A
 * typesetting that failed is kept too, with its source, so the person can
 * read why and take the source elsewhere. Every manuscript made is kept (user
 * decision, 2026-09-23); the node is written as the person's truth, in their
 * branch when their tab is in one.
 *
 * The transport is the kernel client's `call` unless a test hands one in.
 */

export type Transport = (path: string, init: RequestInit) => Promise<Response>;

const FORWARD = "/__kernel/typeset";

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

/** What the service answered, as this extension reads it. */
interface Typeset {
  readonly outcome: Outcome;
  readonly tex: string;
  readonly bib: string;
  readonly pdf?: string;
  readonly log: readonly string[];
}

export interface Made {
  readonly manuscriptId: string;
  readonly revisionId: string;
  readonly outcome: Outcome;
  readonly dataRevision: string;
}

async function words(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error ?? text;
  } catch {
    return text === "" ? `the service answered ${response.status}` : text;
  }
}

/** The venues the typesetting service carries, from its own health answer. */
export async function readVenues(transport: Transport = call): Promise<{ readonly reachable: boolean; readonly venues: readonly Venue[] }> {
  try {
    const answered = await transport(`${FORWARD}/health`, { method: "GET" });
    if (!answered.ok) return { reachable: false, venues: [] };
    const body = (await answered.json()) as { venues?: unknown };
    const venues = Array.isArray(body.venues)
      ? body.venues.flatMap((entry) =>
          typeof entry === "object" && entry !== null && typeof (entry as Venue).id === "string"
            ? [{ id: (entry as Venue).id, name: typeof (entry as Venue).name === "string" ? (entry as Venue).name : (entry as Venue).id }]
            : [],
        )
      : [];
    return { reachable: true, venues };
  } catch {
    return { reachable: false, venues: [] };
  }
}

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

/** The venue a manuscript is made for: the one asked, else the document's
 * own, else the generic article. */
export const venueOf = (document: DocumentView, asked?: string): string => asked ?? document.frontMatter?.venue ?? "generic";

/** Sends a projection to the service and reads its answer, or a refusal. */
export async function typeset(projection: Projection, venue: string, transport: Transport = call): Promise<{ readonly typeset: Typeset; readonly figures: Record<string, unknown>[] } | { readonly failure: string }> {
  const figures = await figuresOf(projection);
  if ("failure" in figures) return figures;
  const answered = await transport(`${FORWARD}/v1/manuscripts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ venue, ast: projection.ast, references: projection.references, files: figures.files }),
  });
  if (!answered.ok) return { failure: await words(answered) };
  const body = (await answered.json()) as Partial<Typeset>;
  if (!isOutcome(body.outcome) || typeof body.tex !== "string") return { failure: "the typesetting service answered no manuscript" };
  return {
    typeset: {
      outcome: body.outcome,
      tex: body.tex,
      bib: typeof body.bib === "string" ? body.bib : "",
      ...(typeof body.pdf === "string" ? { pdf: body.pdf } : {}),
      log: Array.isArray(body.log) ? body.log.filter((line): line is string => typeof line === "string") : [],
    },
    figures: figures.kept,
  };
}

async function keep(bytes: Uint8Array, mediaType: string, filename: string): Promise<GraphOutcome<Record<string, unknown>>> {
  const stored = await putBlob(bytes);
  if (stored.outcome !== "success") return stored as GraphOutcome<never>;
  const objectId = objectIdOfHash(stored.result.hash);
  if (objectId === null) return refuse("store", `the store answered no object for ${filename}`);
  return { outcome: "success", result: { ...blobReference(objectId, mediaType, stored.result.size), filename } };
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

/**
 * Makes one manuscript of a document for a venue — the document's own when
 * none is named, else the generic article — and keeps it.
 */
export async function makeManuscript(input: {
  readonly documentId: string;
  readonly venue?: string;
  readonly by: string;
  readonly transport?: Transport;
}): Promise<GraphOutcome<Made>> {
  const read = await readDocument(input.documentId);
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const document = read.result;
  const venue = venueOf(document, input.venue);
  const revision = document.dataRevision ?? 0;
  const projection = project(document, await citedWorks(document), revision, await glossaryOf(document));
  const answered = await typeset(projection, venue, input.transport ?? call);
  if ("failure" in answered) return refuse("typesetting", answered.failure);
  const made = answered.typeset;

  const files: Record<string, unknown>[] = [];
  const kept = [
    await keep(new TextEncoder().encode(made.tex), "text/x-tex", "manuscript.tex"),
    ...(made.bib !== "" ? [await keep(new TextEncoder().encode(made.bib), "text/x-bibtex", "references.bib")] : []),
    ...(made.pdf !== undefined ? [await keep(Buffer.from(made.pdf, "base64"), "application/pdf", "manuscript.pdf")] : []),
  ];
  for (const file of kept) {
    if (file.outcome !== "success") return file as GraphOutcome<never>;
    files.push(file.result);
  }
  files.push(...answered.figures);

  const manuscriptId = randomUUID();
  const write = manuscriptWrite({
    manuscriptId,
    documentId: input.documentId,
    title: document.title,
    revision,
    venue,
    files,
    made: new Date().toISOString(),
    by: input.by,
    outcome: made.outcome,
    log: made.log,
    omitted: projection.omitted,
  }, "established");
  return commit(
    write.statement,
    write.parameters,
    `make a ${venue} manuscript of ${document.title === "" ? input.documentId : document.title}`,
    async (dataRevision, revisionOf) => ({ manuscriptId, revisionId: await revisionOf(manuscriptId), outcome: made.outcome, dataRevision }),
  );
}

/** What a kept manuscript is made of, as one `manuscript` node. */
export interface ManuscriptFacts {
  readonly manuscriptId: string;
  readonly documentId: string;
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
 * The one write that keeps a manuscript: a press commits it as truth, with
 * `established` said, and a run's `make_manuscript` has the kernel stage it
 * into the run's group (`BO_0293_023`) with no status, since a
 * proposal-scoped write stages a candidate and refuses an explicit
 * `established` (found by the instance check, 2026-09-25). Both keep the
 * same node.
 */
export function manuscriptWrite(facts: ManuscriptFacts, status?: "established"): { readonly statement: string; readonly parameters: Record<string, unknown> } {
  return {
    statement: `CREATE (m:${MANUSCRIPT_TYPE} {id: $m_id, of: $m_of, title: $m_title, revision: $m_revision, venue: $m_venue, files: $m_files, made: $m_made, by: $m_by, outcome: $m_outcome, log: $m_log, omitted: $m_omitted${status === undefined ? "" : `, status: "${status}"`}})`,
    parameters: {
      m_id: facts.manuscriptId,
      m_of: facts.documentId,
      m_title: facts.title,
      m_revision: facts.revision,
      m_venue: facts.venue,
      m_files: facts.files,
      m_made: facts.made,
      m_by: facts.by,
      m_outcome: facts.outcome,
      m_log: facts.log,
      m_omitted: facts.omitted,
    },
  };
}
