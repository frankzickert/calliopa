import { serverContributions as declare, type ApiRoute } from "~/contract";
import { HttpError } from "~/server/http-error";
import { respond } from "~/server/outcome";
import { jsonInit } from "~/server/kernel/client";
import { readSession } from "~/server/session";
import { listInstructions, instructionSummary } from "~/extensions/documents/server/documents";

import type { GrantRow, GrantView, InstructionChoices, InstructionGrants, InstructionTools, SecretView } from "./lib/instructions";
import { choicesFor, createInstruction, documentOf, forward, MIGRATIONS, record } from "./server/instructions";
import { setStanding, standingOf } from "./server/standing";
import { builtinGuard } from "./server/builtins";
import { guardDocuments } from "~/extensions/documents/server/guards";
import { isRecordId } from "~/server/uuid";

/**
 * The server half of `instructions` (`calliopa-bootstrap`'s `BO_0298` and
 * `BO_0311`): the create — a document carrying `record: instruction` and the
 * built-in *Instruction* role, minted unnamed and renamed in the editor; what the
 * chip in a block's command offers; an instruction's tools with their grant, the
 * owner's grant and revoke, and the owner's Settings section with the tools'
 * secrets, all of which the kernel holds and refuses to anyone else; and the
 * executable migration that gives every instruction the role and drops every
 * document's attached instruction on upgrade. What the routes do is
 * `server/instructions.ts`; this half is the routes. Only server code imports
 * this module.
 */

/**
 * An instruction stood on a document or a block, or taken off with
 * `{instruction: null}`, as the person's truth at once (`BO_0349_030`).
 */
const standingRoute = (path: string): ApiRoute => ({
  method: "POST",
  path,
  handle: async (event, params) => {
    const body = record(await event.request.json().catch(() => ({})));
    const instruction = body["instruction"];
    if (instruction !== null && (typeof instruction !== "string" || !isRecordId(instruction)))
      throw new HttpError(400, "an instruction is named by its id, or null to take it off");
    const block = params["block"];
    const { status, body: answer } = respond(
      await setStanding({ documentId: documentOf(params["id"]), ...(block === undefined ? {} : { blockId: block }), instruction }),
    );
    event.json(status, answer);
  },
});

// A built-in instruction is never deleted. BO_0349_035
guardDocuments("instructions", async (documentId) => ({ outcome: "success", result: builtinGuard(documentId) }));

const routes: readonly ApiRoute[] = [
  {
    // A new instruction: a document carrying the record, with one empty block,
    // named as a new document is and renamed in the editor, taking the
    // built-in *Instruction* so the Roles category lists it. BO_0298_014
    // BO_0311_010
    method: "POST",
    path: "instructions",
    handle: async (event) => {
      const body = record(await event.request.json().catch(() => ({})));
      const { status, body: answer } = respond(await createInstruction(typeof body["title"] === "string" ? body["title"] : ""));
      event.json(status === 200 ? 201 : status, answer);
    },
  },
  {
    // What stands on a document and its blocks. BO_0349_030
    method: "GET",
    path: "documents/[id]/standing",
    handle: async (event, params) => {
      const { status, body } = respond(await standingOf(documentOf(params["id"])));
      event.json(status, body);
    },
  },
  standingRoute("documents/[id]/standing"),
  standingRoute("documents/[id]/blocks/[block]/standing"),
  {
    // What the chip in a block's command offers. BO_0311_011
    method: "GET",
    path: "documents/[id]/blocks/[block]/choices",
    handle: async (event, params) => {
      const answer = await choicesFor(documentOf(params["id"]), params["block"] ?? "");
      event.json(200, answer.outcome === "success" ? answer.result : ({ reachable: false, isInstruction: false, instructions: [], last: null } satisfies InstructionChoices));
    },
  },
  {
    // An instruction's tools with their grant, and whether the person is the
    // owner, for the grant control and the code blocks' headlines; nothing
    // for a document that is no instruction. BO_0311_012
    method: "GET",
    path: "documents/[id]/tools",
    handle: async (event, params) => {
      const documentId = documentOf(params["id"]);
      const own = await instructionSummary(documentId);
      if (own.outcome !== "success" || own.result === null) {
        event.json(200, { instruction: false } satisfies InstructionTools);
        return;
      }
      const person = await readSession();
      const owner = person?.owner === true;
      const grant = await forward(`/__kernel/instructions/${encodeURIComponent(documentId)}/grant`, { method: "GET" });
      const secrets = owner ? await forward("/__kernel/secrets/tools", { method: "GET" }) : null;
      event.json(200, {
        instruction: true,
        owner,
        grant: grant.status === 200 ? (grant.body as GrantView) : null,
        secrets: secrets !== null && secrets.status === 200 ? (record(secrets.body)["secrets"] as readonly SecretView[]) : [],
      } satisfies InstructionTools);
    },
  },
  {
    // The owner's grant of outside reach, with the secrets it may read;
    // the kernel refuses anyone else. BO_0311_012
    method: "PUT",
    path: "documents/[id]/grant",
    handle: async (event, params) => {
      const body = record(await event.request.json().catch(() => ({})));
      const secrets = Array.isArray(body["secrets"]) ? body["secrets"].filter((name): name is string => typeof name === "string") : [];
      const { status, body: answer } = await forward(`/__kernel/instructions/${encodeURIComponent(documentOf(params["id"]))}/grant`, jsonInit("PUT", { secrets }));
      event.json(status, answer);
    },
  },
  {
    method: "DELETE",
    path: "documents/[id]/grant",
    handle: async (event, params) => {
      const { status, body } = await forward(`/__kernel/instructions/${encodeURIComponent(documentOf(params["id"]))}/grant`, { method: "DELETE" });
      event.json(status, body);
    },
  },
  {
    // The owner's Settings section: the grants with their instructions' titles,
    // and the named secrets, never a value. The kernel refuses anyone else.
    // BO_0311_040
    method: "GET",
    path: "settings",
    handle: async (event) => {
      const [grants, secrets, listed] = await Promise.all([forward("/__kernel/instructions/", { method: "GET" }), forward("/__kernel/secrets/tools", { method: "GET" }), listInstructions()]);
      if (secrets.status !== 200) {
        event.json(secrets.status, secrets.body);
        return;
      }
      const titles = new Map(listed.outcome === "success" ? listed.result.map((instruction) => [instruction.id, instruction.title] as const) : []);
      const rows = grants.status === 200 ? ((record(grants.body)["grants"] ?? []) as readonly Omit<GrantRow, "title">[]) : [];
      event.json(200, {
        grants: rows.map((grant) => ({ instruction: grant.instruction, title: titles.get(grant.instruction) ?? "", grantedBy: grant.grantedBy, grantedAt: grant.grantedAt, secrets: grant.secrets ?? [] })),
        secrets: (record(secrets.body)["secrets"] ?? []) as readonly SecretView[],
      } satisfies InstructionGrants);
    },
  },
  {
    // A named secret set or replaced, and cleared; the owner's alone, which
    // the kernel holds to. BO_0311_040
    method: "PUT",
    path: "secrets/[name]",
    handle: async (event, params) => {
      const body = record(await event.request.json().catch(() => ({})));
      const { status, body: answer } = await forward(`/__kernel/secrets/tools/${encodeURIComponent(params["name"] ?? "")}`, jsonInit("PUT", { value: typeof body["value"] === "string" ? body["value"] : "" }));
      event.json(status, answer);
    },
  },
  {
    method: "DELETE",
    path: "secrets/[name]",
    handle: async (event, params) => {
      const { status, body } = await forward(`/__kernel/secrets/tools/${encodeURIComponent(params["name"] ?? "")}`, { method: "DELETE" });
      event.json(status, body);
    },
  },
  {
    // An executable migration the kernel runs once per instance when it
    // serves a pin (`calliopa-bootstrap`'s `BO_0312_003`). BO_0311_010
    // BO_0311_020
    method: "POST",
    path: "kernel/migrations/[migration]",
    kernelCallback: true,
    handle: async (event, params) => {
      const migration = MIGRATIONS[params["migration"] ?? ""];
      if (migration === undefined) throw new HttpError(404, `instructions runs no migration ${params["migration"] ?? ""}`);
      const answer = await migration();
      if (answer.outcome !== "success")
        throw new HttpError(502, `the migration could not read the graph: ${"detail" in answer ? String(answer.detail) : answer.outcome}`);
      event.json(200, answer.result);
    },
  },
];

export const contributions = declare({ routes });
