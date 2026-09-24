import { call } from "~/server/kernel/client";

import { recordFromCsl, type WorkRecord } from "../lib/work";

/**
 * The record fetched for an identifier or an address (`BO_0291_017`): the
 * kernel forward `/__kernel/bibliography/` reaches the bibliography service —
 * the Zotero translation server behind a front — whose `/search` answers a
 * DOI, an ISBN, a PMID or an arXiv id and whose `/web` answers a URL, both in
 * the engine's item JSON, converted here through `/export?format=csljson` to
 * the one shape a work stores. A page that lists several answers `300` with
 * a session and the candidates, which a person chooses from and this route
 * posts back. Nothing bills, so nothing waits for a second press.
 *
 * The transport is the kernel client's `call` unless a test hands one in.
 */

export type Transport = (path: string, init: RequestInit) => Promise<Response>;

export const ENGINE = "zotero-translation-server";
const FORWARD = "/__kernel/bibliography";

export type FetchAsk =
  | { readonly identifier: string }
  | { readonly url: string }
  /** A person's choice among the candidates a page listed: the engine's own
   * answer posted back with `items` narrowed to what they chose. */
  | { readonly selection: { readonly url: string; readonly session: string; readonly items: Readonly<Record<string, string>> } };

export type FetchAnswer =
  | { readonly outcome: "record"; readonly record: WorkRecord; readonly others: readonly WorkRecord[] }
  | { readonly outcome: "candidates"; readonly url: string; readonly session: string; readonly items: Readonly<Record<string, string>> }
  | { readonly outcome: "refused"; readonly detail: string };

const looksLikeUrl = (text: string): boolean => /^https?:\/\//iu.test(text.trim());

/** Reads what a person typed as an identifier or an address. */
export function askOf(input: string): FetchAsk {
  const trimmed = input.trim();
  return looksLikeUrl(trimmed) ? { url: trimmed } : { identifier: trimmed.replace(/^doi:/iu, "") };
}

async function words(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string; detail?: string };
    return parsed.error ?? parsed.detail ?? text;
  } catch {
    return text === "" ? `the service answered ${response.status}` : text;
  }
}

/** Fetches a record, or the candidates to choose from, or a refusal in words. */
export async function fetchRecord(ask: FetchAsk, transport: Transport = call): Promise<FetchAnswer> {
  const from = "identifier" in ask ? ask.identifier : "url" in ask ? ask.url : ask.selection.url;
  const path = "identifier" in ask ? `${FORWARD}/search` : `${FORWARD}/web`;
  const body = "selection" in ask ? JSON.stringify(ask.selection) : from;
  const asked = await transport(path, {
    method: "POST",
    headers: { "content-type": "selection" in ask ? "application/json" : "text/plain" },
    body,
  });
  if (asked.status === 300) {
    const choice = (await asked.json()) as { url?: string; session?: string; items?: Record<string, string> };
    if (typeof choice.session !== "string" || choice.items === undefined) return { outcome: "refused", detail: "the page listed several works but the engine named none" };
    return { outcome: "candidates", url: choice.url ?? from, session: choice.session, items: choice.items };
  }
  if (!asked.ok) return { outcome: "refused", detail: await words(asked) };
  const items = (await asked.json()) as unknown;
  if (!Array.isArray(items) || items.length === 0) return { outcome: "refused", detail: "nothing answered a record for that" };
  const exported = await transport(`${FORWARD}/export?format=csljson`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!exported.ok) return { outcome: "refused", detail: await words(exported) };
  const csl = (await exported.json()) as unknown;
  if (!Array.isArray(csl) || csl.length === 0) return { outcome: "refused", detail: "the engine answered a record it could not export" };
  const fetched = { by: ENGINE, at: new Date().toISOString(), from };
  const records: WorkRecord[] = [];
  for (const item of csl) {
    const read = recordFromCsl(item as Record<string, unknown>, fetched);
    if (!("failure" in read)) records.push(read.record);
  }
  const [first, ...others] = records;
  if (first === undefined) return { outcome: "refused", detail: "the engine answered no record with a title" };
  return { outcome: "record", record: first, others };
}
