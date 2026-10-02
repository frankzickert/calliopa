import { serverContributions as declare, type ApiRoute } from "~/contract";
import { HttpError } from "~/server/http-error";
import { respond } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";

import { createKeyword, keywordsOf, mentionedIn, mentionsOf } from "./server/keywords";
import { MIGRATIONS } from "./server/merge";
import { TOOLS, ToolRefusal, type ToolCall } from "./server/tools";

/**
 * The server half of `keywords` (`BO_0301_014`, `BO_0301_017`, `BO_0310`):
 * a document's mentions, a keyword's *Mentioned in*, the keywords the `@`
 * list offers and a keyword created from it, the tools the kernel calls and
 * the migration it runs. Only server code imports this module; a dependent
 * extension imports `server/keywords.ts` directly.
 */

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const idOf = (params: Readonly<Record<string, string>>, name: string, what: string): string => {
  const id = params[name] ?? "";
  if (!isRecordId(id)) throw new HttpError(404, `no such ${what}`);
  return id;
};

const routes: readonly ApiRoute[] = [
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
    // What the `@` list offers: every keyword by title with its aliases.
    // BO_0310_024
    method: "GET",
    path: "keywords",
    handle: async (event) => {
      const all = await keywordsOf();
      const { status, body } = respond(
        all.outcome === "success"
          ? { outcome: "success" as const, result: all.result.map((keyword) => ({ id: keyword.id, title: keyword.title, aliases: keyword.aliases })) }
          : all,
      );
      event.json(status, body);
    },
  },
  {
    // *Create keyword "…"*: a document titled with what was typed, taking
    // *Keyword*, both the person's truth at once. BO_0310_024
    method: "POST",
    path: "keywords",
    handle: async (event) => {
      const body = record(await event.request.json().catch(() => ({})));
      const { status, body: answer } = respond(await createKeyword(typeof body["title"] === "string" ? body["title"] : ""));
      event.json(status, answer);
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
    // What the kernel calls for a run (`BO_0301_017`, `BO_0310_025`): answered
    // only with the callback secret, as every kernelCallback route is.
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
  {
    // An executable migration the kernel runs once per instance when it
    // serves a pin (`calliopa-bootstrap`'s `BO_0312_003`), handed the owner's
    // settings (`BO_0310_021`).
    method: "POST",
    path: "kernel/migrations/[migration]",
    kernelCallback: true,
    handle: async (event, params) => {
      const migration = MIGRATIONS[params["migration"] ?? ""];
      if (migration === undefined) throw new HttpError(404, `keywords runs no migration ${params["migration"] ?? ""}`);
      const body = record(await event.request.json().catch(() => ({})));
      const answer = await migration(body["settings"] ?? null);
      if (answer.outcome !== "success")
        throw new HttpError(502, `the migration could not read the graph: ${"detail" in answer ? String(answer.detail) : answer.outcome}`);
      event.json(200, answer.result);
    },
  },
];

export const contributions = declare({ routes });
