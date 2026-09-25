import { serverContributions as declare, type ApiRoute } from "~/contract";
import { HttpError } from "~/server/http-error";
import { refusal, respond } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";

import { UNNAMED_ROLE, type RolesListing } from "./lib/roles";
import {
  createDocumentRole,
  listDocumentRoles,
  readDocumentRole,
  reviseDocumentRole,
  rolesOf,
  setBlockRole,
  setDocumentRole,
  type RoleCommand,
} from "./server/roles";
import { TOOLS, ToolRefusal, type ToolCall } from "./server/tools";

/**
 * The server half of `doc-block-roles` (`BO_0299_012`, `BO_0299_013`,
 * `BO_0299_017`): the catalogue the Roles section is handed and the role
 * page reads, the acts on a role, a document's roles read and the two
 * assignments written, and the tool the kernel calls. Only server code
 * imports this module; a dependent extension imports `server/roles.ts`
 * directly (`BO_0299_016`).
 */

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const readers = {
  roles: async (): Promise<RolesListing> => {
    const listed = await listDocumentRoles();
    return listed.outcome === "success"
      ? { reachable: true, roles: listed.result }
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

async function bodyOf(event: {
  readonly request: Request;
}): Promise<Record<string, unknown>> {
  return record(await event.request.json().catch(() => ({})));
}

/** One act on a role, as the page posts it, or why it is not one. */
export function parseRoleCommand(
  body: unknown,
): { command: RoleCommand } | { failure: string } {
  const value = record(body);
  const command = text(value["command"]);
  const name = text(value["name"]);
  const description = text(value["description"]);
  const blockRole = text(value["blockRole"]);
  switch (command) {
    case "rename":
      return name === null
        ? { failure: "rename carries a name" }
        : { command: { command, name } };
    case "describe":
      return description === null
        ? { failure: "describe carries a description" }
        : { command: { command, description } };
    case "retire":
    case "restore":
      return { command: { command } };
    case "addBlockRole":
      return name === null
        ? { failure: "addBlockRole carries a name" }
        : {
            command: {
              command,
              name,
              ...(description === null ? {} : { description }),
            },
          };
    case "renameBlockRole":
      if (blockRole === null || !isRecordId(blockRole))
        return { failure: "renameBlockRole names the block role by its id" };
      return name === null
        ? { failure: "renameBlockRole carries a name" }
        : { command: { command, blockRole, name } };
    case "describeBlockRole":
      if (blockRole === null || !isRecordId(blockRole))
        return { failure: "describeBlockRole names the block role by its id" };
      return description === null
        ? { failure: "describeBlockRole carries a description" }
        : { command: { command, blockRole, description } };
    case "retireBlockRole":
    case "restoreBlockRole":
      if (blockRole === null || !isRecordId(blockRole))
        return { failure: `${command} names the block role by its id` };
      return { command: { command, blockRole } };
    case "reorder": {
      const ids = Array.isArray(value["blockRoles"])
        ? value["blockRoles"]
        : null;
      if (
        ids === null ||
        !ids.every((id) => typeof id === "string" && isRecordId(id))
      )
        return {
          failure: "reorder carries blockRoles, the ids in their new order",
        };
      return { command: { command, blockRoles: ids as string[] } };
    }
    default:
      return { failure: `${String(command)} is not an act on a role` };
  }
}

/** A role's id from a body, or null for *No role*; anything else is refused. */
function choiceOf(
  body: Record<string, unknown>,
  key: string,
  what: string,
): string | null {
  const value = body[key];
  if (value === null) return null;
  if (typeof value === "string" && isRecordId(value)) return value;
  throw new HttpError(
    400,
    `${what} names a role by its id, or null for no role`,
  );
}

const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "roles",
    handle: async (event) => {
      event.json(200, await readers.roles());
    },
  },
  {
    // A new document role, minted unnamed unless the body names it, offering
    // nothing yet; the page is where it is shaped. BO_0299_012
    method: "POST",
    path: "roles",
    handle: async (event) => {
      const body = await bodyOf(event);
      const name = text(body["name"]) ?? UNNAMED_ROLE;
      const description = text(body["description"]);
      const { status, body: answer } = respond(
        await createDocumentRole({
          name,
          ...(description === null ? {} : { description }),
        }),
      );
      event.json(status === 200 ? 201 : status, answer);
    },
  },
  {
    method: "GET",
    path: "roles/[id]",
    handle: async (event, params) => {
      const { status, body } = respond(
        await readDocumentRole(idOf(params, "id", "document role")),
      );
      event.json(status, body);
    },
  },
  {
    // One act on a role — rename, describe, retire, restore, and the same on
    // a block role it offers, plus add and reorder — as truth at once.
    method: "POST",
    path: "roles/[id]",
    handle: async (event, params) => {
      const id = idOf(params, "id", "document role");
      const parsed = parseRoleCommand(await bodyOf(event));
      if ("failure" in parsed) {
        const { status, body } = respond(
          refusal("commandShape", parsed.failure),
        );
        event.json(status, body);
        return;
      }
      const { status, body } = respond(
        await reviseDocumentRole(id, parsed.command),
      );
      event.json(status, body);
    },
  },
  {
    // The document's role and each block's, in reading order; `?branch=`
    // reads in the tab's branch. BO_0299_013
    method: "GET",
    path: "documents/[id]",
    handle: async (event, params) => {
      const branch = event.url.searchParams.get("branch");
      const { status, body } = respond(
        await rolesOf(
          idOf(params, "id", "document"),
          branch === null || branch === "" ? {} : { branch },
        ),
      );
      event.json(status, body);
    },
  },
  {
    method: "POST",
    path: "documents/[id]/role",
    handle: async (event, params) => {
      const documentId = idOf(params, "id", "document");
      const documentRole = choiceOf(
        await bodyOf(event),
        "documentRole",
        "a document's role",
      );
      const { status, body } = respond(
        await setDocumentRole({ documentId, documentRole }),
      );
      event.json(status, body);
    },
  },
  {
    method: "POST",
    path: "documents/[id]/blocks/[blockId]/role",
    handle: async (event, params) => {
      const documentId = idOf(params, "id", "document");
      const blockId = idOf(params, "blockId", "block");
      const blockRole = choiceOf(
        await bodyOf(event),
        "blockRole",
        "a block's role",
      );
      const { status, body } = respond(
        await setBlockRole({ documentId, blockId, blockRole }),
      );
      event.json(status, body);
    },
  },
  {
    // What the kernel calls for a run (`BO_0299_017`): answered only with the
    // callback secret, as every kernelCallback route is.
    method: "POST",
    path: "kernel/tools/[tool]",
    kernelCallback: true,
    handle: async (event, params) => {
      const tool = TOOLS[params["tool"] as keyof typeof TOOLS];
      if (tool === undefined)
        throw new HttpError(
          404,
          `doc-block-roles answers no tool ${params["tool"] ?? ""}`,
        );
      const body = await bodyOf(event);
      const call: ToolCall = {
        input: record(body["input"]),
        run: (body["run"] ?? { id: "", group: "", pin: 0 }) as ToolCall["run"],
      };
      try {
        event.json(200, await tool(call));
      } catch (error) {
        if (error instanceof ToolRefusal)
          throw new HttpError(422, error.message);
        throw error;
      }
    },
  },
];

export const contributions = declare({ readers, routes });
