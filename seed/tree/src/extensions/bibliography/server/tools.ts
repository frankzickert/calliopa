import { atDataRevision } from "~/server/ccgw/branch-scope";

import { duplicateOf, readWorkRecord, recordFromCsl, type WorkRecord } from "../lib/work";
import { workLineOf } from "../lib/line";
import { listWorks, mintSourceIds, sourceStatements } from "./works";

/**
 * The tools a run holds for sources (`BO_0291_021`, `BO_0313_022`), answered on
 * this extension's kernel callback route. A run fetches a record with the
 * kernel's own `fetch_record` — the one path it has to the bibliography
 * service (`calliopa-bootstrap`'s `BO_0291_035`) — and proposes it here; it
 * reads the bibliography to cite from it. Nothing here writes truth:
 * `propose_work` answers statements the kernel stages into the run's group,
 * and the person accepts the work with the rest.
 */
export interface ToolCall {
  readonly input: Readonly<Record<string, unknown>>;
  readonly run: { readonly id: string; readonly group: string; readonly pin: number };
}

export interface ToolAnswer {
  readonly result: unknown;
  readonly stage?: readonly { readonly statement: string; readonly parameters: Record<string, unknown>; readonly rationale: string }[];
}

/** A tool refused: the run reads the reason and nothing is staged. */
export class ToolRefusal extends Error {}

/**
 * Reads what a run hands `propose_work`: a CSL-JSON item as `fetch_record`
 * answered it (CSL's `type`), or a work's own record (`kind`).
 */
export function recordOfInput(input: Readonly<Record<string, unknown>>): WorkRecord {
  const given = input["record"];
  if (typeof given !== "object" || given === null || Array.isArray(given)) {
    throw new ToolRefusal("propose_work needs the record: a CSL-JSON item as fetch_record answered it");
  }
  const item = given as Record<string, unknown>;
  const from = typeof input["from"] === "string" && input["from"].trim() !== "" ? input["from"].trim() : "a run";
  const read =
    item["kind"] !== undefined
      ? readWorkRecord(item)
      : recordFromCsl(item, { by: "fetch_record", at: new Date().toISOString(), from });
  if ("failure" in read) throw new ToolRefusal(`the record is not a source's: ${read.failure}`);
  return read.record;
}

/**
 * Proposes one source, staged into the run's group (`BO_0313_022`): the
 * source document carrying `record: source` and *Source*, its fields filled
 * from the record and an empty paragraph for notes, as one statement. A
 * record sharing a DOI, an ISBN or a URL with a source here at the run's pin
 * is refused by naming that source, so the run cites it instead of proposing
 * it twice.
 */
export async function proposeWork(call: ToolCall): Promise<ToolAnswer> {
  const record = recordOfInput(call.input);
  const held = await atDataRevision(call.run.pin, () => listWorks());
  if (held.outcome !== "success") throw new ToolRefusal(`the sources could not be read: ${held.outcome}`);
  const duplicate = duplicateOf(record, held.result);
  if (duplicate !== undefined) {
    throw new ToolRefusal(`this source is already here as ${duplicate.workId}: ${duplicate.record.title}. Cite that source rather than proposing it again.`);
  }
  const ids = mintSourceIds();
  const parameters: Record<string, unknown> = {};
  const statements = sourceStatements(record, ids, parameters, false);
  return {
    result: { workId: ids.documentId, title: record.title, line: workLineOf(record), proposed: true },
    stage: [{ statement: statements.join("; "), parameters, rationale: `source: ${record.title}` }],
  };
}

/**
 * The sources at the run's pin, for a run drafting a citation: each source
 * document's identity, its line and its record but for the abstract,
 * narrowed by every word of an optional query.
 */
export async function readWorks(call: ToolCall): Promise<ToolAnswer> {
  const held = await atDataRevision(call.run.pin, () => listWorks());
  if (held.outcome !== "success") throw new ToolRefusal(`the sources could not be read: ${held.outcome}`);
  const query = typeof call.input["query"] === "string" ? call.input["query"].trim().toLowerCase() : "";
  const works = held.result
    .map((work) => {
      const { abstract: _abstract, file, ...record } = work.record;
      return { workId: work.workId, line: workLineOf(work.record), record, file: file !== undefined };
    })
    .filter((work) => query === "" || query.split(/\s+/u).every((word) => `${work.line} ${work.record.DOI ?? ""} ${(work.record.tags ?? []).join(" ")}`.toLowerCase().includes(word)));
  return {
    result: {
      works,
      note: "Each source is a document; cite it as a run carrying cite: {work: <workId>, locator?} with empty text, in propose_document_changes. A source that is not here is fetched with fetch_record and proposed with propose_work first.",
    },
  };
}

/** The tools as this extension's `ext.tool` members declare them, by route. */
export const TOOLS = { propose_work: proposeWork, read_works: readWorks } as const;
