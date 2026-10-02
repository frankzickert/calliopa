import { serverContributions as declare, type ApiRoute } from "~/contract";
import { HttpError } from "~/server/http-error";
import { refusal, respond } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";

import { BUILTIN_CREATES, isFieldType, isRoleId, UNNAMED_ROLE, type RolesListing, type RoleView } from "./lib/roles";
import { MIGRATIONS } from "./server/migrations";
import {
  createRole,
  documentsCarrying,
  listRoles,
  readRole,
  reviseRole,
  rolesOf,
  setRole,
  setValues,
  type RoleCommand,
  type Subject,
} from "./server/roles";
import { TOOLS, ToolRefusal, type ToolCall } from "./server/tools";

/**
 * The server half of `doc-block-roles` (`BO_0299`, reshaped by `BO_0309`):
 * the catalogue the Roles section is handed and the role page reads, the acts
 * on a role, the documents a role's row unfolds to, a document's roles read,
 * a role taken or cleared and values stored on a document or a block, the
 * tools the kernel calls and the migrations it runs. Only server code imports
 * this module; a dependent extension imports `server/roles.ts` directly
 * (`BO_0299_016`).
 */

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/**
 * A built-in role with the create action its owner contributes, when that
 * extension is active and its kind is in the build (`BO_0313_011`).
 */
export const withCreate = (role: RoleView, registered: (kind: string) => boolean): RoleView => {
  const create = role.builtin ? BUILTIN_CREATES[role.id] : undefined;
  return create !== undefined && registered(create.kind) ? { ...role, create } : role;
};

const readers = {
  roles: async (): Promise<RolesListing> => {
    const listed = await listRoles();
    // Imported when read: the registry imports this module, so a static
    // import would read it half-built.
    const { isRegisteredKind } = await import("~/server/registry");
    return listed.outcome === "success"
      ? { reachable: true, roles: listed.result.map((role) => withCreate(role, isRegisteredKind)) }
      : { reachable: false, roles: [] };
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

const roleIdOf = (params: Readonly<Record<string, string>>, name: string): string => {
  const id = decodeURIComponent(params[name] ?? "");
  if (!isRoleId(id)) throw new HttpError(404, "no such role");
  return id;
};

async function bodyOf(event: {
  readonly request: Request;
}): Promise<Record<string, unknown>> {
  return record(await event.request.json().catch(() => ({})));
}

const optionsOf = (value: unknown): string[] | null | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((option) => typeof option === "string")) return null;
  return value as string[];
};

/** One act on a role, as the page posts it, or why it is not one. */
export function parseRoleCommand(
  body: unknown,
): { command: RoleCommand } | { failure: string } {
  const value = record(body);
  const command = text(value["command"]);
  const name = text(value["name"]);
  const description = text(value["description"]);
  const key = text(value["key"]);
  const role = text(value["role"]);
  switch (command) {
    case "rename":
      return name === null ? { failure: "rename carries a name" } : { command: { command, name } };
    case "describe":
      return description === null
        ? { failure: "describe carries a description" }
        : { command: { command, description } };
    case "retire":
    case "restore":
      return { command: { command } };
    case "offer":
    case "unoffer":
      return role === null || !isRoleId(role)
        ? { failure: `${command} names the role by its id` }
        : { command: { command, role } };
    case "addField": {
      const type = value["type"];
      if (!isFieldType(type)) return { failure: "addField carries a type: text, longText, number, date, boolean, choice, reference or file" };
      const options = optionsOf(value["options"]);
      if (options === null) return { failure: "a choice's options are a list of words" };
      const required = value["required"];
      if (required !== undefined && typeof required !== "boolean") return { failure: "required is true or false" };
      return {
        command: {
          command,
          name: name ?? "",
          type,
          ...(required === undefined ? {} : { required }),
          ...(options === undefined ? {} : { options }),
        },
      };
    }
    case "reviseField": {
      if (key === null || key === "") return { failure: "reviseField names the field by its key" };
      const type = value["type"];
      if (type !== undefined && !isFieldType(type)) return { failure: `${String(type)} is not a field type` };
      const options = optionsOf(value["options"]);
      if (options === null) return { failure: "a choice's options are a list of words" };
      const required = value["required"];
      if (required !== undefined && typeof required !== "boolean") return { failure: "required is true or false" };
      return {
        command: {
          command,
          key,
          ...(name === null ? {} : { name }),
          ...(type === undefined ? {} : { type }),
          ...(required === undefined ? {} : { required }),
          ...(options === undefined ? {} : { options }),
          ...("default" in value ? { default: value["default"] } : {}),
        },
      };
    }
    case "removeField":
      return key === null || key === ""
        ? { failure: "removeField names the field by its key" }
        : { command: { command, key } };
    case "moveField": {
      const by = value["by"];
      if (key === null || key === "") return { failure: "moveField names the field by its key" };
      return by === -1 || by === 1
        ? { command: { command, key, by } }
        : { failure: "moveField moves by -1 or 1" };
    }
    case "sendWithPrompt": {
      const entry = text(value["entry"]);
      const on = value["on"];
      if (entry === null || entry === "") return { failure: "sendWithPrompt names a field's key or an offered role's id" };
      return typeof on === "boolean"
        ? { command: { command, entry, on } }
        : { failure: "sendWithPrompt is on or off" };
    }
    case "blocks": {
      const allowed = value["allowed"];
      return typeof allowed === "boolean"
        ? { command: { command, allowed } }
        : { failure: "blocks is allowed: true or false" };
    }
    default:
      return { failure: `${String(command)} is not an act on a role` };
  }
}

/** Whether the body takes the role or clears it. */
function takenOf(body: Record<string, unknown>): boolean {
  const taken = body["taken"];
  if (typeof taken === "boolean") return taken;
  throw new HttpError(400, "a role is taken with taken: true and cleared with taken: false");
}

const subjectOf = (params: Readonly<Record<string, string>>): Subject => {
  const documentId = idOf(params, "id", "document");
  return params["blockId"] === undefined
    ? { documentId }
    : { documentId, blockId: idOf(params, "blockId", "block") };
};

const takeRoute = (path: string): ApiRoute => ({
  // A role taken or cleared, as the person's truth at once. BO_0309_012
  method: "POST",
  path,
  handle: async (event, params) => {
    const subject = subjectOf(params);
    const body = await bodyOf(event);
    const role = text(body["role"]);
    if (role === null || !isRoleId(role)) throw new HttpError(400, "a role is named by its id");
    const { status, body: answer } = respond(await setRole({ ...subject, role, taken: takenOf(body) }));
    event.json(status, answer);
  },
});

const valuesRoute = (path: string): ApiRoute => ({
  // Values of a role the subject takes, as the person's truth at once. BO_0309_013
  method: "POST",
  path,
  handle: async (event, params) => {
    const subject = subjectOf(params);
    const role = roleIdOf(params, "roleId");
    const body = await bodyOf(event);
    const { status, body: answer } = respond(await setValues({ ...subject, role, values: record(body["values"]) }));
    event.json(status, answer);
  },
});

const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "roles",
    handle: async (event) => {
      event.json(200, await readers.roles());
    },
  },
  {
    // A new role, minted unnamed unless the body names it, offering nothing
    // and carrying no fields yet; the page is where it is shaped.
    method: "POST",
    path: "roles",
    handle: async (event) => {
      const body = await bodyOf(event);
      const name = text(body["name"]) ?? UNNAMED_ROLE;
      const description = text(body["description"]);
      const { status, body: answer } = respond(
        await createRole({ name, ...(description === null ? {} : { description }) }),
      );
      event.json(status === 200 ? 201 : status, answer);
    },
  },
  {
    method: "GET",
    path: "roles/[id]",
    handle: async (event, params) => {
      const { status, body } = respond(await readRole(roleIdOf(params, "id")));
      event.json(status, body);
    },
  },
  {
    // What a built-in role's row unfolds to: the documents carrying it. BO_0309_015
    method: "GET",
    path: "roles/[id]/documents",
    handle: async (event, params) => {
      const { status, body } = respond(await documentsCarrying(roleIdOf(params, "id")));
      event.json(status, body);
    },
  },
  {
    // One act on a role, as truth at once.
    method: "POST",
    path: "roles/[id]",
    handle: async (event, params) => {
      const id = roleIdOf(params, "id");
      const parsed = parseRoleCommand(await bodyOf(event));
      if ("failure" in parsed) {
        const { status, body } = respond(refusal("commandShape", parsed.failure));
        event.json(status, body);
        return;
      }
      const { status, body } = respond(await reviseRole(id, parsed.command));
      event.json(status, body);
    },
  },
  {
    // The document's roles and each block's, in reading order; `?branch=`
    // reads in the tab's branch.
    method: "GET",
    path: "documents/[id]",
    handle: async (event, params) => {
      const branch = event.url.searchParams.get("branch");
      const { status, body } = respond(
        await rolesOf(idOf(params, "id", "document"), branch === null || branch === "" ? {} : { branch }),
      );
      event.json(status, body);
    },
  },
  takeRoute("documents/[id]/roles"),
  takeRoute("documents/[id]/blocks/[blockId]/roles"),
  valuesRoute("documents/[id]/roles/[roleId]/fields"),
  valuesRoute("documents/[id]/blocks/[blockId]/roles/[roleId]/fields"),
  {
    // What the kernel calls for a run: answered only with the callback
    // secret, as every kernelCallback route is.
    method: "POST",
    path: "kernel/tools/[tool]",
    kernelCallback: true,
    handle: async (event, params) => {
      const tool = TOOLS[params["tool"] as keyof typeof TOOLS];
      if (tool === undefined)
        throw new HttpError(404, `doc-block-roles answers no tool ${params["tool"] ?? ""}`);
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
        throw new HttpError(404, `doc-block-roles runs no migration ${params["migration"] ?? ""}`);
      const answer = await migration();
      if (answer.outcome !== "success")
        throw new HttpError(502, `the migration could not read the graph: ${"detail" in answer ? String(answer.detail) : answer.outcome}`);
      event.json(200, answer.result);
    },
  },
];

export const contributions = declare({ readers, routes });
