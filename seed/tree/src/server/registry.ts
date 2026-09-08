import type { RequestEvent } from "@builder.io/qwik-city";
import type { LibraryItem } from "~/contract";
import { HOST_KINDS } from "~/lib/tabs";
import { matchRoute, qualify, type RegisteredParty, type RegisteredSection } from "~/registry";
import { REGISTRY } from "~/registry.gen";
import { SERVER_REGISTRY } from "~/registry.server.gen";
import { api } from "./api";

/**
 * The server's reading of the two generated registries: the library readers
 * the page loaders call, the API dispatch behind the catch-all, the tab kinds
 * the process registry validates against, and the parties the settings
 * extension lists. Only this module and the server halves import
 * `registry.server.gen`, so nothing a server half holds can reach the client
 * bundle through the registry. BO_0202_002
 */

/** Every tab kind the build knows: the host's bare ones and every extension's qualified ones. */
export function registeredKinds(): readonly string[] {
  return Object.keys(REGISTRY.kinds);
}

export function isRegisteredKind(kind: string): boolean {
  return REGISTRY.kinds[kind] !== undefined || (HOST_KINDS as readonly string[]).includes(kind);
}

export function librarySections(): readonly RegisteredSection[] {
  return REGISTRY.sections;
}

/** What a section's reader answered, with an item section's targets qualified. */
async function readOne(section: RegisteredSection): Promise<unknown> {
  const reader = SERVER_REGISTRY.readers[section.key];
  const empty = section.component === undefined ? [] : null;
  if (reader === undefined) return empty;
  try {
    const answer = await reader();
    if (section.component !== undefined) return answer;
    return (Array.isArray(answer) ? (answer as LibraryItem[]) : []).map((item) =>
      item.open === undefined
        ? item
        : { ...item, open: { ...item.open, kind: qualify(section.extension, item.open.kind) } },
    );
  } catch {
    // A reader that fails renders its section empty, the way a refused listing
    // did: the library is one region of a shell that still works without it.
    return empty;
  }
}

/** Every section's data by key, for the page loaders. BO_0202_005 */
export async function readLibrary(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    REGISTRY.sections.map(async (section) => [section.key, await readOne(section)] as const),
  );
  return Object.fromEntries(entries);
}

/** One section re-read, or `undefined` for a section nothing contributes. */
export async function readSection(extension: string, name: string): Promise<unknown> {
  const section = REGISTRY.sections.find((candidate) => candidate.key === qualify(extension, name));
  return section === undefined ? undefined : readOne(section);
}

/** The catch-all's dispatch: by extension id, then by the table's own patterns. BO_0202_006 */
export async function dispatch(event: RequestEvent, extension: string, path: string): Promise<void> {
  const table = SERVER_REGISTRY.routes[extension];
  if (table === undefined) {
    event.json(404, { error: `no extension ${extension} contributes an API` });
    return;
  }
  const matched = matchRoute(table, event.method, path);
  if (matched === null) {
    event.json(404, { error: `${extension} answers nothing at ${event.method} ${path}` });
    return;
  }
  await api(event, () => matched.route.handle(event, matched.params));
}

export function parties(): readonly RegisteredParty[] {
  return SERVER_REGISTRY.parties;
}

export function partyOf(id: string): RegisteredParty | undefined {
  return SERVER_REGISTRY.parties.find((party) => party.id === id);
}

/** Whether a party is a channel — somewhere the author's work goes — which publishing consults. BO_0202_008 */
export function isChannelParty(id: string): boolean {
  return partyOf(id)?.kind === "channel";
}
