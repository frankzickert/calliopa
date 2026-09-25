import { serverContributions as declare, type ApiRoute } from "~/contract";
import { HttpError } from "~/server/http-error";
import { respond } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";

import { NO_ROLE, parseRoleChoice, type KeywordsListing, type KeywordsSettings } from "./lib/keywords";
import { listKeywords, mentionedIn, mentionsOf } from "./server/keywords";
import { readSettings, writeSettings } from "./server/settings";
import { TOOLS, ToolRefusal, type ToolCall } from "./server/tools";

/**
 * The server half of `keywords` (`BO_0301_012`, `BO_0301_014`, `BO_0301_017`):
 * the listing the Keywords section is handed, the settings read and written,
 * a document's mentions, a keyword's *Mentioned in*, and the tool the kernel
 * calls. Only server code imports this module; a dependent extension imports
 * `server/keywords.ts` directly.
 */

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const readers = {
  keywords: async (): Promise<KeywordsListing> => listKeywords(),
};

const idOf = (params: Readonly<Record<string, string>>, name: string, what: string): string => {
  const id = params[name] ?? "";
  if (!isRecordId(id)) throw new HttpError(404, `no such ${what}`);
  return id;
};

/** A role's id from a body, or null for *None*; anything else is refused. */
function roleOf(body: Record<string, unknown>, key: string, current: string | null): string | null {
  if (!(key in body)) return current;
  const value = body[key];
  if (value === null || value === NO_ROLE) return null;
  if (typeof value === "string" && isRecordId(value)) return value;
  throw new HttpError(400, `${key} names a role by its id, or null for none`);
}

/** The settings a PUT carries, over what stands: a key left out keeps its
 * value, so a choice posts one field at a time. */
export function settingsFrom(body: unknown, current: KeywordsSettings): KeywordsSettings {
  const value = record(body);
  let definitionRole = current.definitionRole;
  if ("definitionRole" in value) {
    const choice = value["definitionRole"];
    if (choice === null || choice === NO_ROLE) definitionRole = null;
    else if (typeof choice === "string") {
      const parsed = parseRoleChoice(choice);
      if (parsed === null || !isRecordId(parsed.id)) throw new HttpError(400, "definitionRole is block:<id> or document:<id>, or null for none");
      definitionRole = parsed;
    } else {
      const parsed = record(choice);
      const kind = parsed["kind"];
      const id = parsed["id"];
      if ((kind !== "block" && kind !== "document") || typeof id !== "string" || !isRecordId(id))
        throw new HttpError(400, "definitionRole carries kind, block or document, and the role's id");
      definitionRole = { kind, id };
    }
  }
  return {
    keywordRole: roleOf(value, "keywordRole", current.keywordRole),
    definitionRole,
    aliasRole: roleOf(value, "aliasRole", current.aliasRole),
  };
}

const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "settings",
    handle: async (event) => {
      event.json(200, await readSettings());
    },
  },
  {
    // The owner's choices, written whole; the kernel refuses anyone else and
    // the refusal is answered in its words. BO_0301_012
    method: "PUT",
    path: "settings",
    handle: async (event) => {
      const body = await event.request.json().catch(() => ({}));
      const next = settingsFrom(body, await readSettings());
      try {
        event.json(200, await writeSettings(next));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new HttpError(/forbidden|403|owner/iu.test(message) ? 403 : 502, `The keyword settings were not saved: ${message}`);
      }
    },
  },
  {
    // A document's mentions in reading order; `?branch=` reads in the tab's
    // branch. BO_0301_014
    method: "GET",
    path: "documents/[id]",
    handle: async (event, params) => {
      const branch = event.url.searchParams.get("branch");
      const { status, body } = respond(await mentionsOf(idOf(params, "id", "document"), branch === null || branch === "" ? {} : { branch }));
      event.json(status, body);
    },
  },
  {
    // Who mentions a keyword; a document that is no keyword answers with
    // keyword null and nothing listed. BO_0301_016
    method: "GET",
    path: "keywords/[id]/mentioned-in",
    handle: async (event, params) => {
      const { status, body } = respond(await mentionedIn(idOf(params, "id", "document")));
      event.json(status, body);
    },
  },
  {
    // What the kernel calls for a run (`BO_0301_017`): answered only with the
    // callback secret, as every kernelCallback route is.
    method: "POST",
    path: "kernel/tools/[tool]",
    kernelCallback: true,
    handle: async (event, params) => {
      const tool = TOOLS[params["tool"] as keyof typeof TOOLS];
      if (tool === undefined) throw new HttpError(404, `keywords answers no tool ${params["tool"] ?? ""}`);
      const body = record(await event.request.json().catch(() => ({})));
      const call: ToolCall = {
        input: record(body["input"]),
        run: (body["run"] ?? { id: "", group: "", pin: 0 }) as ToolCall["run"],
      };
      try {
        event.json(200, await tool(call));
      } catch (error) {
        if (error instanceof ToolRefusal) throw new HttpError(422, error.message);
        throw error;
      }
    },
  },
];

export const contributions = declare({ readers, routes });
