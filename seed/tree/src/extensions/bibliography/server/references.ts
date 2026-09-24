import { readDocument } from "~/extensions/documents/server/documents";
import type { CitationAnswer } from "~/contract";
import type { GraphOutcome } from "~/server/outcome";

import { workLineOf } from "../lib/line";
import type { Segment } from "../lib/segment";
import { styleFor, stylesAnswer, type StyleId } from "../lib/styles";
import { render, type Cited } from "./render";
import { instanceStyle } from "./style";
import { listWorks, type WorkView } from "./works";

/**
 * A document's references (`BO_0291_026`, `BO_0291_027`, `BO_0291_020`): its
 * cited works in the document's style — citation order with a label for a
 * numeric style, by author for the others — each entry rendered by
 * citeproc-js, with what a citation's hover card shows, and the cited works
 * not at the pin. The numbers are the ones `documents`' own read gives, which
 * this extension may call because it depends on `documents`.
 */
export interface Reference {
  readonly number: number;
  readonly workId: string;
  readonly title: string;
  readonly line: string;
  readonly label?: string;
  readonly entry: readonly Segment[];
  readonly doi?: string;
  readonly url?: string;
  readonly file: boolean;
}

export interface References {
  readonly style: StyleId;
  readonly references: readonly Reference[];
  readonly missing: readonly string[];
}

/** The works held, in the document's number order, for the works it cites. */
export function orderedWorks(numbers: Readonly<Record<string, number>>, works: readonly WorkView[]): WorkView[] {
  const byId = new Map(works.map((work) => [work.workId, work]));
  return Object.entries(numbers)
    .sort((left, right) => left[1] - right[1])
    .flatMap(([workId]) => {
      const work = byId.get(workId);
      return work === undefined ? [] : [work];
    });
}

export function referencesFrom(style: StyleId, numbers: Readonly<Record<string, number>>, missing: readonly string[], works: readonly WorkView[], cited: readonly Cited[]): References {
  const ordered = orderedWorks(numbers, works);
  const byId = new Map(ordered.map((work) => [work.workId, work]));
  const rendered = render(style, ordered.map((work) => ({ workId: work.workId, record: work.record })), cited);
  const references: Reference[] = rendered.entries.flatMap((entry) => {
    const work = byId.get(entry.workId);
    if (work === undefined) return [];
    const record = work.record;
    return [
      {
        number: numbers[entry.workId] ?? 0,
        workId: entry.workId,
        title: record.title,
        line: workLineOf(record),
        ...(entry.label !== undefined ? { label: entry.label } : {}),
        entry: entry.entry,
        ...(record.DOI !== undefined ? { doi: record.DOI } : {}),
        ...(record.URL !== undefined ? { url: record.URL } : {}),
        file: record.file !== undefined,
      },
    ];
  });
  return { style, references, missing };
}

export async function referencesOf(documentId: string, style?: string): Promise<GraphOutcome<References>> {
  const document = await readDocument(documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  // The route's style, else the document's own choice, else the instance's
  // default. BO_0291_037
  const chosen = styleFor(style, document.result.citationStyle, await instanceStyle());
  const numbers = document.result.citationNumbers ?? {};
  const missing = document.result.missingWorks ?? [];
  if (Object.keys(numbers).length === 0) return { outcome: "success", result: { style: chosen, references: [], missing } };
  const works = await listWorks();
  if (works.outcome !== "success") return works as GraphOutcome<never>;
  const cited: Cited[] = [];
  for (const block of document.result.blocks) {
    if (block.kind !== "text" || block.standing === "discarded") continue;
    for (const run of block.runs) if (run.cite !== undefined) cited.push({ work: run.cite.work, ...(run.cite.locator === undefined ? {} : { locator: run.cite.locator }) });
  }
  return { outcome: "success", result: referencesFrom(chosen, numbers, missing, works.result, cited) };
}

/**
 * How a document's citations read in its style (`BO_0291_030`): this
 * extension's answer to `documents`' read, over the works the read found in
 * the order it numbered them. The document's own style when it names one,
 * the instance's default otherwise.
 */
export async function labelsFor(request: { readonly style?: string; readonly order: readonly string[]; readonly cited: readonly Cited[] }): Promise<CitationAnswer> {
  const instanceDefault = await instanceStyle();
  const style = styleFor(request.style, undefined, instanceDefault);
  const styles = stylesAnswer(style, instanceDefault);
  const works = await listWorks();
  if (works.outcome !== "success") return { labels: {}, styles };
  const numbers = Object.fromEntries(request.order.map((work, index) => [work, index + 1]));
  const ordered = orderedWorks(numbers, works.result);
  return { labels: { ...render(style, ordered.map((work) => ({ workId: work.workId, record: work.record })), request.cited).labels }, styles };
}
