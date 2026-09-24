import type { RequestEvent } from "@builder.io/qwik-city";
import type {
  CitationAnswer,
  CitationRequest,
  FocusedWorkContribution,
  LibraryGlyph,
  LibraryItem,
  PartyDescriptor,
  SendOutcome,
  SendQuote,
  SendRequest,
  SenderDescriptor,
} from "~/contract";
import { HOST_KINDS } from "~/lib/tabs";
import { matchRoute, mergeRoster, qualify, type RegisteredParty, type RegisteredSection } from "~/registry";
import { REGISTRY } from "~/registry.gen";
import { SERVER_REGISTRY } from "~/registry.server.gen";
import { api } from "./api";
import { KERNEL_CALLBACK_HEADER, kernelCallbackRefusal } from "./kernel-callback";

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

/**
 * What an item is called, asked of the sections that list its kind. The frame
 * names things it does not own — a refinement process names the document it
 * refined — and what an item is called is the extension's to say, so this asks
 * rather than reads another extension's model. Answers null when nothing lists
 * it, which is what a tree without that extension answers. BO_0255_007
 */
export async function labelOf(kind: string, itemId: string): Promise<string | null> {
  for (const section of REGISTRY.sections) {
    if (section.opens !== kind) continue;
    const answered = await readOne(section);
    if (!Array.isArray(answered)) continue;
    for (const item of answered as readonly { id?: unknown; label?: unknown }[]) {
      if (item.id === itemId && typeof item.label === "string") return item.label;
    }
  }
  return null;
}

/**
 * What the items of a kind are marked with, asked of every extension that has
 * something to say about them and merged in extension order. An extension that
 * throws contributes nothing, the way a section reader that throws renders its
 * section empty. BO_0256_008
 */
export async function glyphsFor(kind: string): Promise<Readonly<Record<string, LibraryGlyph>>> {
  const merged: Record<string, LibraryGlyph> = {};
  for (const read of SERVER_REGISTRY.itemGlyphs) {
    try {
      Object.assign(merged, await read(kind));
    } catch {
      continue;
    }
  }
  return merged;
}

/**
 * How a child of this target kind is made and read, or `undefined` for a
 * kind that opens no focused work. The shell asks rather than writing an
 * extension's vocabulary itself. CA_0065_001
 */
export function focusedWorkFor(kind: string): FocusedWorkContribution | undefined {
  return SERVER_REGISTRY.focusedWork[kind];
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
  if (matched.route.kernelCallback === true) {
    const refusal = kernelCallbackRefusal(event.request.headers.get(KERNEL_CALLBACK_HEADER), process.env["CALLIOPA_KERNEL_CALLBACK_SECRET"]);
    if (refusal !== null) {
      event.json(403, { error: refusal });
      return;
    }
  }
  await api(event, () => matched.route.handle(event, matched.params));
}

/**
 * Every party: the descriptors the build contributes, then each runtime
 * roster's answer in extension order, merged by `mergeRoster`'s rule. A roster
 * that throws contributes nothing for that read, the way a section reader
 * that throws renders its section empty. CA_0049_001
 */
/**
 * The senders contributed beside the agents (`BO_0273_035`), in extension
 * order. Ids are namespaced by their extension; one outside its namespace is
 * dropped rather than shadowing an agent, and a roster that throws contributes
 * none — the menu is one region of a shell that still works without it.
 */
export async function senders(): Promise<readonly SenderDescriptor[]> {
  const merged: SenderDescriptor[] = [];
  for (const { extension, roster } of SERVER_REGISTRY.senders) {
    let answered: readonly SenderDescriptor[];
    try {
      answered = await roster();
    } catch {
      continue;
    }
    for (const sender of answered) {
      if (!sender.id.startsWith(`${extension}:`)) continue;
      if (merged.some((held) => held.id === sender.id)) continue;
      merged.push(sender);
    }
  }
  return merged;
}

/** The extension a sender belongs to, or null for an id nothing offers. */
export function senderExtension(id: string): string | null {
  const found = SERVER_REGISTRY.senders.find((one) => id.startsWith(`${one.extension}:`));
  return found?.extension ?? null;
}

/** Hands a command to the sender it names. Refused for an id nothing offers. */
export async function sendToSender(request: SendRequest): Promise<SendOutcome> {
  const found = SERVER_REGISTRY.senders.find((one) => request.sender.startsWith(`${one.extension}:`));
  if (found === undefined) return { ok: false, error: `Nothing offers ${request.sender}.` };
  return found.send(request);
}

/**
 * What a command to this sender would cost. Free, and never part of a press:
 * an extension that offers no quote, or whose quote throws, answers nothing
 * and the shell shows nothing rather than a guess. BO_0279_009
 */
export async function quoteSender(request: SendRequest): Promise<SendQuote> {
  const found = SERVER_REGISTRY.senders.find((one) => request.sender.startsWith(`${one.extension}:`));
  if (found?.quote === undefined) return { ok: false };
  try {
    return await found.quote(request);
  } catch {
    return { ok: false };
  }
}

export async function parties(): Promise<readonly RegisteredParty[]> {
  let merged: readonly RegisteredParty[] = SERVER_REGISTRY.parties;
  for (const { extension, roster } of SERVER_REGISTRY.rosters) {
    let answered: readonly PartyDescriptor[];
    try {
      answered = await roster();
    } catch {
      continue;
    }
    merged = mergeRoster(merged, extension, answered);
  }
  return merged;
}

export async function partyOf(id: string): Promise<RegisteredParty | undefined> {
  return (await parties()).find((party) => party.id === id);
}

/** Whether a party is a channel — somewhere the author's work goes — which publishing consults. BO_0202_008 */
export async function isChannelParty(id: string): Promise<boolean> {
  return (await partyOf(id))?.kind === "channel";
}

/**
 * How a document's citations read in its style (`BO_0291_030`), from the one
 * extension that answers, or null when none does or it could not answer — a
 * citation is then drawn as its number, which is never wrong.
 */
export async function resolveCitations(request: CitationRequest): Promise<CitationAnswer | null> {
  const resolver = SERVER_REGISTRY.citations;
  if (resolver === undefined) return null;
  try {
    return await resolver.resolve(request);
  } catch {
    return null;
  }
}
