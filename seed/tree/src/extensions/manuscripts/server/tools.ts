
import { port } from "~/server/port";
import { readDocument } from "~/extensions/documents/server/documents";
import { isBlobReference } from "~/server/ccgw/blobs";
import { isRecordId } from "~/server/uuid";

import { isOutcome, isRenditionType, type Outcome, type RenditionType } from "../lib/rendition";
import { citedWorks, figuresOf, glossaryOf, renditionWrite } from "./make";
import { project } from "./project";
import { MakingRefusal, readMaking } from "./structures-read";

/**
 * This extension's half of a run's manuscript (`BO_0293_023`, and
 * `calliopa-bootstrap`'s `BO_0312_020`–`BO_0312_021`): `make_manuscript`
 * is the kernel's own tool — a tool's callback holds no person's session and
 * the gate admits a run's grant on no typesetting path, so the kernel is the
 * one caller of the service (user decision, 2026-09-25). The kernel asks two
 * callback routes here, answered only with the callback secret. `project`
 * answers what the service takes for a document carrying *Format* and its
 * whole reading order, read at the run's pin with the venue and front matter
 * of the roles the run names — *Format* is taken by documents alone
 * (`calliopa-bootstrap`'s `BO_0332_030`). `kept` takes the typesetting's
 * outcome and the blob references the kernel put and answers the statements
 * of one `formatRendition` node on that document, `by` the run's principal, which the
 * kernel stages into the run's group. Nothing here writes: a run's manuscript
 * proposes no block and changes no property.
 */

/** What the kernel posts a route: the input and the run. */
export interface ToolCall {
  readonly input: Readonly<Record<string, unknown>>;
  readonly run: {
    readonly id: string;
    readonly group: string;
    readonly pin: number;
    readonly person?: string;
    readonly system?: boolean;
    /** The principal the kernel stages as: what a run's manuscript is `by`. */
    readonly principal?: string;
  };
}

/** What `kept` answers the kernel: the identity, and the writes to stage. */
export interface ToolAnswer {
  readonly result: unknown;
  readonly stage?: readonly { readonly statement: string; readonly parameters: Record<string, unknown>; readonly rationale: string }[];
}

/** A route refused: the run reads the reason and nothing is staged. */
export class ToolRefusal extends Error {}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The document a call names, as a record id. */
export function documentOfInput(input: Readonly<Record<string, unknown>>): string {
  const document = text(input["document"]);
  if (document === "" || !isRecordId(document)) throw new ToolRefusal("make_manuscript needs document, the document's record id");
  return document;
}

const structureOfInput = (input: Readonly<Record<string, unknown>>, key: "venueStructure" | "paperStructure"): string | undefined => {
  const role = text(input[key]);
  return role === "" ? undefined : role;
};

/** What the projection answers the kernel: the service's request, and what
 * the kept node and the run need to know about it. */
export interface Projected {
  /** The document carrying *Format*, which the rendition is kept on. */
  readonly document: string;
  readonly title: string;
  readonly venue: string;
  readonly revision: number;
  readonly request: { readonly venue: string; readonly ast: unknown; readonly references: readonly Record<string, unknown>[]; readonly files: Record<string, string> };
  readonly omitted: readonly string[];
  /** The figures as blob references with the names the source includes
   * them by, kept beside the source. */
  readonly figures: readonly Record<string, unknown>[];
  /** The role field keys read, and the ones looked for and not found. */
  readonly read: readonly string[];
  readonly missing: readonly string[];
}

const reasonOf = (outcome: { outcome: string } & Record<string, unknown>): string =>
  outcome.outcome === "validationFailure"
    ? (outcome["failures"] as readonly { detail: string }[]).map((failure) => failure.detail).join(" ")
    : `the document could not be read: ${outcome.outcome}`;

/**
 * The document carrying *Format* projected whole at the run's pin
 * (`BO_0332_030`), with the venue and the front matter of the roles the call
 * names, the figures' bytes read from the store, ready for the service. A
 * part formatted on its own is a block's focused work, a document of its own.
 */
export async function projectForKernel(call: ToolCall): Promise<Projected> {
  const documentId = documentOfInput(call.input);
  // At the run's pin through its group, as the shell's scope reads. BO_0344_010
  const read = await readDocument(documentId);
  if (read.outcome !== "success") throw new ToolRefusal(reasonOf(read));
  const document = read.result;
  const revision = document.dataRevision ?? call.run.pin;
  let making;
  try {
    making = await readMaking({
      documentId,
      ...(structureOfInput(call.input, "venueStructure") === undefined ? {} : { venueStructure: structureOfInput(call.input, "venueStructure") as string }),
      ...(structureOfInput(call.input, "paperStructure") === undefined ? {} : { paperStructure: structureOfInput(call.input, "paperStructure") as string }),
    });
  } catch (error) {
    if (error instanceof MakingRefusal) throw new ToolRefusal(error.message);
    throw error;
  }
  const projection = project(document, await citedWorks(document), revision, await glossaryOf(document), making.front);
  const figures = await figuresOf(projection);
  if ("failure" in figures) throw new ToolRefusal(figures.failure);
  // The service sets citations by the venue template's own style, so a
  // citation style the venue role names is said, not silently dropped.
  const omitted =
    making.citationStyle === undefined
      ? projection.omitted
      : [...projection.omitted, `The citation style ${making.citationStyle}: the typesetting sets citations by the ${making.venue} template's own style.`];
  return {
    document: documentId,
    title: document.title,
    venue: making.venue,
    revision,
    request: { venue: making.venue, ast: projection.ast, references: projection.references, files: figures.files },
    omitted,
    figures: figures.kept,
    read: making.read,
    missing: making.missing,
  };
}

/** What the kernel hands `kept`: the projection's facts and the typesetting's outcome. */
export interface Kept {
  readonly document: string;
  readonly type: RenditionType;
  readonly title: string;
  readonly venue: string;
  readonly revision: number;
  readonly outcome: Outcome;
  readonly log: readonly string[];
  readonly omitted: readonly string[];
  readonly files: readonly Record<string, unknown>[];
}

const words = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

/** Reads what the kernel hands `kept`, refusing what is not a rendition's. */
export function keptOfInput(input: Readonly<Record<string, unknown>>): Kept {
  const document = documentOfInput(input);
  const type = input["type"] === undefined ? "pdf" : input["type"];
  if (!isRenditionType(type)) throw new ToolRefusal("a kept rendition's type is text, table, image, video, pdf or structured");
  const venue = text(input["venue"]);
  if (venue === "") throw new ToolRefusal("a kept manuscript names its venue");
  const revision = input["revision"];
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) throw new ToolRefusal("a kept manuscript names the revision it projects");
  const outcome = input["outcome"];
  if (!isOutcome(outcome)) throw new ToolRefusal("a kept manuscript's outcome is ok, errors, failed or timed out");
  const answered = Array.isArray(input["files"]) ? input["files"] : [];
  if (answered.length === 0) throw new ToolRefusal("a kept manuscript holds at least its source");
  const files = [...answered, ...(Array.isArray(input["figures"]) ? input["figures"] : [])];
  for (const file of files) {
    if (!isBlobReference(file) || typeof (file as { filename?: unknown }).filename !== "string") {
      throw new ToolRefusal("each of a kept manuscript's files is a blob reference with its filename");
    }
  }
  return {
    document,
    type,
    title: text(input["title"]),
    venue,
    revision,
    outcome,
    log: words(input["log"]),
    omitted: words(input["omitted"]),
    files: files as Record<string, unknown>[],
  };
}

/**
 * The kept rendition composed for the run: one `formatRendition` node on the
 * document carrying *Format*, `by` the run's principal, staged by the kernel
 * into the run's group and listed at the document's end.
 */
export function keptForKernel(call: ToolCall): ToolAnswer {
  const kept = keptOfInput(call.input);
  const by = text(call.run.principal) !== "" ? text(call.run.principal) : text(call.run.person);
  if (by === "") throw new ToolRefusal("a kept manuscript says who made it: the run names its principal");
  const renditionId = port.uuid();
  const write = renditionWrite({
    renditionId,
    of: kept.document,
    documentId: kept.document,
    type: kept.type,
    title: kept.title,
    revision: kept.revision,
    venue: kept.venue,
    files: kept.files,
    made: new Date().toISOString(),
    by,
    outcome: kept.outcome,
    log: kept.log,
    omitted: kept.omitted,
  });
  return {
    result: { renditionId, outcome: kept.outcome, files: kept.files.map((file) => file["filename"]) },
    stage: [{ ...write, rationale: `a ${kept.venue} manuscript of ${kept.title === "" ? kept.document : kept.title}` }],
  };
}
