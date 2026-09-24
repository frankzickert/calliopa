import CSL from "citeproc";

// The styles and the locale are the Citation Style Language project's files,
// fetched by pnpm from its repositories at pinned commits when the interface
// is built — the lockfile holds their integrity — and never carried in the
// seed (`ui.shell`'s `BO_0291_029`, `calliopa-bootstrap`'s `BO_0291_038`).
import apa from "csl-styles/apa.csl?raw";
import chicagoAuthorDate from "csl-styles/chicago-author-date.csl?raw";
import ieee from "csl-styles/ieee.csl?raw";
import enUS from "csl-locales/locales-en-US.xml?raw";
import type { Segment } from "../lib/segment";
import { STYLES, type StyleId } from "../lib/styles";
import type { WorkRecord } from "../lib/work";

/**
 * Citations and reference lists in a document's style (`BO_0291_020`),
 * rendered by citeproc-js — taken under AGPL-3.0 and used unmodified (user
 * decision, 2026-09-24) — from the works' CSL-JSON, with the shipped styles
 * and the `en-US` locale alone (user decision, 2026-09-24). Server only: the
 * styles are a quarter of a megabyte and never reach the browser.
 */
const STYLE_XML: Readonly<Record<StyleId, string>> = { ieee, apa, "chicago-author-date": chicagoAuthorDate };

/** One citation in the order the document reads, as a run carries it. */
export interface Cited {
  readonly work: string;
  readonly locator?: string;
}

/** The key a citation's label is answered under: its work and its locator. */
export const citationKey = (cited: Cited): string => `${cited.work}\u0000${cited.locator ?? ""}`;

export interface Rendered {
  /** Each citation's in-text label, by `citationKey`. */
  readonly labels: Readonly<Record<string, string>>;
  /** The reference list, in the style's own order — citation order for a
   * numeric style, by author for the others — each entry with the label a
   * numeric style sets beside it. */
  readonly entries: readonly { readonly workId: string; readonly label?: string; readonly entry: readonly Segment[] }[];
}

const LOCATOR_LABELS: readonly (readonly [RegExp, string])[] = [
  [/^pp?\.?\s*/iu, "page"],
  [/^pages?\s+/iu, "page"],
  [/^(§+|sec(t(ion)?)?\.?)\s*/iu, "section"],
  [/^ch(ap(ter)?)?\.?\s*/iu, "chapter"],
  [/^fig(ure)?s?\.?\s*/iu, "figure"],
  [/^para(graph)?s?\.?\s*/iu, "paragraph"],
  [/^vol(ume)?s?\.?\s*/iu, "volume"],
  [/^l(ine)?s?\.\s*/iu, "line"],
];

/**
 * A locator as a person writes it — *p. 12*, *pp. 12–14*, *§3*, *fig. 2* —
 * as citeproc takes it: a label and the locator. A bare number is a page;
 * words it cannot read ride as a suffix, so nothing written is lost.
 */
export function locatorOf(written: string | undefined): { locator?: string; label?: string; suffix?: string } {
  const text = (written ?? "").trim();
  if (text === "") return {};
  for (const [pattern, label] of LOCATOR_LABELS) {
    if (pattern.test(text)) return { label, locator: text.replace(pattern, "").trim() };
  }
  if (/^[\divxlc][\d\s,–\-ivxlc]*$/iu.test(text)) return { label: "page", locator: text };
  return { suffix: `, ${text}` };
}

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const decode = (text: string): string =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (whole, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

/** citeproc's HTML as segments: italics kept, every other tag dropped, entities decoded. */
export function segmentsOf(html: string): Segment[] {
  const out: Segment[] = [];
  let italic = 0;
  for (const piece of html.split(/(<[^>]+>)/u)) {
    if (piece === "") continue;
    if (piece.startsWith("<")) {
      const tag = /^<\s*(\/)?\s*([a-z]+)/iu.exec(piece);
      if (tag !== null && (tag[2] === "i" || tag[2] === "em")) italic += tag[1] === "/" ? -1 : 1;
      continue;
    }
    const text = decode(piece);
    const last = out[out.length - 1];
    if (last !== undefined && (last.italic === true) === italic > 0) out[out.length - 1] = { ...last, text: last.text + text };
    else out.push(italic > 0 ? { text, italic: true } : { text });
  }
  const trimmed = out.map((segment) => ({ ...segment, text: segment.text.replace(/\s+/gu, " ") }));
  if (trimmed[0] !== undefined) trimmed[0] = { ...trimmed[0], text: trimmed[0].text.trimStart() };
  const end = trimmed.length - 1;
  if (trimmed[end] !== undefined) trimmed[end] = { ...trimmed[end]!, text: trimmed[end]!.text.trimEnd() };
  return trimmed.filter((segment) => segment.text !== "");
}

/** A work's record as the CSL-JSON item citeproc reads: `kind` back to `type`. */
const itemOf = (workId: string, record: WorkRecord): Record<string, unknown> => {
  const { kind, fetched: _fetched, file: _file, tags: _tags, ...rest } = record;
  return { ...rest, id: workId, type: kind };
};

/**
 * Renders a document's citations and its reference list in one style.
 * `works` are the cited works by id in the document's number order — so a
 * numeric style numbers them as the document's read does — and `cited` every
 * citation in reading order. A work missing from `works` is not rendered.
 */
export function render(style: StyleId, works: readonly { readonly workId: string; readonly record: WorkRecord }[], cited: readonly Cited[]): Rendered {
  const byId = new Map(works.map((work) => [work.workId, itemOf(work.workId, work.record)]));
  const engine = new CSL.Engine({ retrieveLocale: () => enUS, retrieveItem: (id) => byId.get(id) ?? { id, type: "document", title: id } }, STYLE_XML[style], "en-US", true);
  engine.updateItems(works.map((work) => work.workId));
  const labels: Record<string, string> = {};
  for (const one of cited) {
    const key = citationKey(one);
    if (labels[key] !== undefined || !byId.has(one.work)) continue;
    labels[key] = segmentsOf(engine.makeCitationCluster([{ id: one.work, ...locatorOf(one.locator) }]))
      .map((segment) => segment.text)
      .join("");
  }
  const numeric = STYLES.find((candidate) => candidate.id === style)?.numeric === true;
  const bibliography = engine.makeBibliography();
  const entries: { workId: string; label?: string; entry: Segment[] }[] = [];
  if (bibliography !== false) {
    const [params, html] = bibliography;
    html.forEach((entry, index) => {
      const workId = params.entry_ids[index]?.[0];
      if (workId === undefined) return;
      const margin = /<div class="csl-left-margin">([\s\S]*?)<\/div>/u.exec(entry);
      const body = margin === null ? entry : entry.replace(margin[0], "");
      const label = margin === null ? undefined : segmentsOf(margin[1] ?? "").map((segment) => segment.text).join("");
      entries.push({ workId, ...(numeric && label !== undefined && label !== "" ? { label } : {}), entry: segmentsOf(body) });
    });
  }
  return { labels, entries };
}
