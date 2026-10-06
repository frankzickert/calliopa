import { serverContributions as declare, type ApiRoute } from "~/contract";
import { HttpError } from "~/server/http-error";
import { refusal, respond } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";

import { guardDocuments, nameDocuments, nameListedDocuments } from "~/extensions/documents/server/guards";

import { BUILTIN_CREATES, isStructureId, SOURCES_SOURCE, UNNAMED_STRUCTURE, type StructuresListing, type StructureView } from "./lib/structures";
import { MIGRATIONS } from "./server/migrations";
import {
  createStructure,
  documentsCarrying,
  guardOf,
  listStructures,
  readStructure,
  reviseStructure,
  structuresOf,
  setStructure,
  setFieldChild,
  setValues,
  structureDocuments,
  structureKindOf,
  type StructureCommand,
  type Subject,
} from "./server/structures";
import { TOOLS, ToolRefusal, type ToolCall } from "./server/tools";

/**
 * The server half of `structures` (`BO_0299`, reshaped by `BO_0309`):
 * the catalogue the Structures section is handed and the structure page reads, the acts
 * on a structure, the documents a structure's row unfolds to, a document's structures read,
 * a structure taken or cleared and values stored on a document or a block, the
 * tools the kernel calls and the migrations it runs. Only server code imports
 * this module; a dependent extension imports `server/structures.ts` directly
 * (`BO_0299_016`).
 */

// What documents asks before a deletion, a retitling or a block leaving a
// document: a structure's document is never deleted, a built-in's title and
// release fields stay (RO_0005_020).
guardDocuments("structures", guardOf);
// A run chip names a document using *Structure* a structure. DO_0034_008
nameDocuments("structures", structureKindOf);
// The Documents section hides the documents defining a structure until shown,
// named for the whole listing in one read. DO_0042_004
nameListedDocuments("structures", structureDocuments);

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/**
 * A built-in structure with the create action its owner contributes, when that
 * extension is active and its kind is in the build (`BO_0313_011`).
 */
export const withCreate = (structure: StructureView, registered: (kind: string) => boolean): StructureView => {
  const create = structure.builtin ? BUILTIN_CREATES[structure.id] : undefined;
  return create !== undefined && registered(create.kind) ? { ...structure, create } : structure;
};

const readers = {
  structures: async (): Promise<StructuresListing> => {
    const listed = await listStructures();
    // Imported when read: the registry imports this module, so a static
    // import would read it half-built.
    const { isRegisteredKind } = await import("~/server/registry");
    return listed.outcome === "success"
      ? { reachable: true, structures: listed.result.map((structure) => withCreate(structure, isRegisteredKind)) }
      : { reachable: false, structures: [] };
  },
};

const idOf = (
  params: Readonly<Record<string, string>>,
  name: string,
  what: string,
): string => {
  const id = params[name] ?? "";
  if (!isRecordId(id)) throw new HttpError(404, `no such ${what}`);
  return id;
};

const structureIdOf = (params: Readonly<Record<string, string>>, name: string): string => {
  const id = decodeURIComponent(params[name] ?? "");
  if (!isStructureId(id)) throw new HttpError(404, "no such structure");
  return id;
};

async function bodyOf(event: {
  readonly request: Request;
}): Promise<Record<string, unknown>> {
  return record(await event.request.json().catch(() => ({})));
}

/** One act on a structure, as a structure's document posts it, or why it
 * is not one (`RO_0005_003`): its name, description, fields and what it
 * allows are written in the document itself. */
export function parseStructureCommand(
  body: unknown,
): { command: StructureCommand } | { failure: string } {
  const value = record(body);
  const command = text(value["command"]);
  switch (command) {
    case "retire":
    case "restore":
      return { command: { command } };
    case "sendWithPrompt": {
      const entry = text(value["entry"]);
      const on = value["on"];
      if (entry === null || entry === "") return { failure: "sendWithPrompt names a field's key or an allowed structure's id" };
      return typeof on === "boolean"
        ? { command: { command, entry, on } }
        : { failure: "sendWithPrompt is on or off" };
    }
    default:
      return { failure: `${String(command)} is not an act on a structure: a structure's name, description, fields and what it allows are written in its document` };
  }
}

/** Whether the body takes the structure or clears it. */
function takenOf(body: Record<string, unknown>): boolean {
  const taken = body["taken"];
  if (typeof taken === "boolean") return taken;
  throw new HttpError(400, "a structure is taken with taken: true and cleared with taken: false");
}

const subjectOf = (params: Readonly<Record<string, string>>): Subject => {
  const documentId = idOf(params, "id", "document");
  return params["blockId"] === undefined
    ? { documentId }
    : { documentId, blockId: idOf(params, "blockId", "block") };
};

const takeRoute = (path: string): ApiRoute => ({
  // A structure taken or cleared, as the person's truth at once. BO_0309_012
  method: "POST",
  path,
  handle: async (event, params) => {
    const subject = subjectOf(params);
    const body = await bodyOf(event);
    const structure = text(body["structure"]);
    if (structure === null || !isStructureId(structure)) throw new HttpError(400, "a structure is named by its id");
    const { status, body: answer } = respond(await setStructure({ ...subject, structure, taken: takenOf(body) }));
    event.json(status, answer);
  },
});

/**
 * A block put into a field, or taken out (`calliopa-bootstrap`'s
 * `BO_0349_020`): `{field, child}` puts it, `{field, child, put: false}` takes
 * it out. Null for a body that names no child, which stores values instead.
 */
export function parseFieldChild(
  body: Readonly<Record<string, unknown>>,
): { readonly field: string; readonly child: string; readonly put: boolean } | { readonly failure: string } | null {
  if (!("child" in body)) return null;
  const field = text(body["field"]);
  const child = text(body["child"]);
  if (field === null || field === "") return { failure: "a block is put into a field named by its key" };
  if (child === null || !isRecordId(child)) return { failure: "a block put into a field is named by its id" };
  const put = body["put"];
  if (put !== undefined && typeof put !== "boolean") return { failure: "put is true or false" };
  return { field, child, put: put !== false };
}

const valuesRoute = (path: string): ApiRoute => ({
  // Values of a structure the subject takes, as the person's truth at once
  // (BO_0309_013); or a block put into one of its fields (BO_0349_020).
  method: "POST",
  path,
  handle: async (event, params) => {
    const subject = subjectOf(params);
    const structure = structureIdOf(params, "structureId");
    const body = await bodyOf(event);
    const child = parseFieldChild(body);
    if (child !== null && "failure" in child) throw new HttpError(400, child.failure);
    const { status, body: answer } = respond(
      child === null
        ? await setValues({ ...subject, structure, values: record(body["values"]) })
        : await setFieldChild({ ...subject, structure, ...child }),
    );
    event.json(status, answer);
  },
});

const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "structures",
    handle: async (event) => {
      event.json(200, await readers.structures());
    },
  },
  {
    // A new structure, minted unnamed unless the body names it, offering nothing
    // and carrying no fields yet; the page is where it is shaped.
    method: "POST",
    path: "structures",
    handle: async (event) => {
      const body = await bodyOf(event);
      const name = text(body["name"]) ?? UNNAMED_STRUCTURE;
      const description = text(body["description"]);
      const { status, body: answer } = respond(
        await createStructure({ name, ...(description === null ? {} : { description }) }),
      );
      event.json(status === 200 ? 201 : status, answer);
    },
  },
  {
    method: "GET",
    path: "structures/[id]",
    handle: async (event, params) => {
      const { status, body } = respond(await readStructure(structureIdOf(params, "id")));
      event.json(status, body);
    },
  },
  {
    // What a built-in structure's row unfolds to: the documents carrying it. BO_0309_015
    method: "GET",
    path: "structures/[id]/documents",
    handle: async (event, params) => {
      const { status, body } = respond(await documentsCarrying(structureIdOf(params, "id")));
      event.json(status, body);
    },
  },
  {
    // One act on a structure, as truth at once.
    method: "POST",
    path: "structures/[id]",
    handle: async (event, params) => {
      const id = structureIdOf(params, "id");
      const parsed = parseStructureCommand(await bodyOf(event));
      if ("failure" in parsed) {
        const { status, body } = respond(refusal("commandShape", parsed.failure));
        event.json(status, body);
        return;
      }
      const { status, body } = respond(await reviseStructure(id, parsed.command));
      event.json(status, body);
    },
  },
  {
    // The document's structures and each block's, in reading order; `?branch=`
    // reads in the tab's branch.
    method: "GET",
    path: "documents/[id]",
    handle: async (event, params) => {
      const branch = event.url.searchParams.get("branch");
      const { status, body } = respond(
        await structuresOf(idOf(params, "id", "document"), branch === null || branch === "" ? {} : { branch }),
      );
      event.json(status, body);
    },
  },
  takeRoute("documents/[id]/structures"),
  takeRoute("documents/[id]/blocks/[blockId]/structures"),
  valuesRoute("documents/[id]/structures/[structureId]/fields"),
  valuesRoute("documents/[id]/blocks/[blockId]/structures/[structureId]/fields"),
  {
    // What the kernel calls for a run: answered only with the callback
    // secret, as every kernelCallback route is.
    method: "POST",
    path: "kernel/tools/[tool]",
    kernelCallback: true,
    handle: async (event, params) => {
      const tool = TOOLS[params["tool"] as keyof typeof TOOLS];
      if (tool === undefined)
        throw new HttpError(404, `structures answers no tool ${params["tool"] ?? ""}`);
      const body = await bodyOf(event);
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
  {
    // An executable migration the kernel runs once per instance when it
    // serves a pin (`calliopa-bootstrap`'s `BO_0312_003`). BO_0309_011, BO_0309_014
    method: "POST",
    path: "kernel/migrations/[migration]",
    kernelCallback: true,
    handle: async (event, params) => {
      const migration = MIGRATIONS[params["migration"] ?? ""];
      if (migration === undefined)
        throw new HttpError(404, `structures runs no migration ${params["migration"] ?? ""}`);
      const answer = await migration();
      if (answer.outcome !== "success")
        throw new HttpError(502, `the migration could not read the graph: ${"detail" in answer ? String(answer.detail) : answer.outcome}`);
      event.json(200, answer.result);
    },
  },
];

/**
 * The sources a field may suggest from, which *Field*'s *Suggests* picks
 * among (`RO_0005`): every source the build holds but this one, by name.
 */
const suggestionSources = [
  {
    name: SOURCES_SOURCE.split(":")[1] ?? "sources",
    label: "Suggestion sources",
    answer: async () => {
      // Imported when read: the registry imports this module.
      const { suggestionSources: sources } = await import("~/server/registry");
      return {
        suggestions: sources()
          .filter((one) => one.source !== SOURCES_SOURCE)
          .map((one) => ({ value: one.source, label: one.label })),
      };
    },
  },
];

export const contributions = declare({ readers, routes, suggestionSources });
