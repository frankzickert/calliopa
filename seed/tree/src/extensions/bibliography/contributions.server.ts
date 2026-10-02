import { serverContributions as declare, type ApiRoute } from "~/contract";
import { readBlob } from "~/server/ccgw/blobs";
import { HttpError } from "~/server/http-error";
import { respond } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";
import { documentsCiting } from "~/extensions/documents/server/cited-by";

import { handleWorkCommand } from "./server/api";
import { labelsFor, referencesOf } from "./server/references";
import { instanceStyle, setInstanceStyle } from "./server/style";
import { isStyleId } from "./lib/styles";
import { TOOLS, ToolRefusal, type ToolCall } from "./server/tools";
import { askOf, fetchRecord, type FetchAsk } from "./server/fetch";
import { MIGRATIONS } from "./server/migrations";
import { listWorks, readWork, sourceAnswer } from "./server/works";

/**
 * The server half of `bibliography` (`BO_0291_016`–`BO_0291_019`, reshaped by
 * `BO_0313`): its own command route under `/api/x/bibliography/`, the fetch
 * of a record through the kernel forward, the sources — documents carrying
 * *Source* — for the citation control and a source's own reads, a source's
 * *File* streamed back typed as what it is, the tools the kernel calls and
 * the migration it runs. Only server code imports this module.
 */

const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

const routes: readonly ApiRoute[] = [
  {
    method: "POST",
    path: "commands",
    handle: async (event) => {
      const { status, body } = await handleWorkCommand(event.request);
      event.json(status, body);
    },
  },
  {
    method: "GET",
    path: "works",
    handle: async (event) => {
      const listed = await listWorks();
      if (listed.outcome !== "success") {
        event.json(502, listed);
        return;
      }
      event.json(200, { works: listed.result });
    },
  },
  {
    method: "GET",
    path: "works/[id]",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such source");
      const { status, body } = sourceAnswer(await readWork(id));
      event.json(status, body);
    },
  },
  {
    // The documents citing the work, each with the blocks that do.
    // BO_0291_023
    method: "GET",
    path: "works/[id]/cited-by",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such source");
      const source = await readWork(id);
      if (source.outcome !== "success") {
        const { status, body } = sourceAnswer(source);
        event.json(status, body);
        return;
      }
      const { status, body } = respond(await documentsCiting(id));
      event.json(status, body);
    },
  },
  {
    // A source's *File*, typed as what it is: the generic blob route answers every
    // object as octet-stream by the mirror rule. BO_0291_018 BO_0313_021
    method: "GET",
    path: "works/[id]/file",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such source");
      const work = await readWork(id);
      if (work.outcome !== "success") throw new HttpError(404, "no such source");
      const file = work.result.record.file as { hash?: unknown; mediaType?: unknown; filename?: unknown } | undefined;
      if (file === undefined || typeof file.hash !== "string") throw new HttpError(404, "this source holds no file");
      let bytes: Uint8Array;
      try {
        bytes = await readBlob(file.hash);
      } catch {
        throw new HttpError(404, "the source's file could not be read");
      }
      const name = typeof file.filename === "string" ? file.filename : `${work.result.record.title}.pdf`;
      event.headers.set("Content-Type", typeof file.mediaType === "string" ? file.mediaType : "application/pdf");
      event.headers.set("Content-Disposition", `inline; filename="${name.replace(/"/gu, "")}"`);
      event.cacheControl({ maxAge: 31536000, public: false, immutable: true });
      event.send(200, bytes);
    },
  },
  {
    // The instance's default citation style: read by anyone signed in, set
    // by the owner — the kernel refuses anyone else. BO_0291_020
    method: "GET",
    path: "settings",
    handle: async (event) => {
      event.json(200, { style: await instanceStyle() });
    },
  },
  {
    method: "PUT",
    path: "settings",
    handle: async (event) => {
      const body = record(await event.request.json().catch(() => ({})));
      if (!isStyleId(body["style"])) throw new HttpError(400, "the style is one of the shipped styles");
      event.json(200, { style: await setInstanceStyle(body["style"]) });
    },
  },
  {
    // A document's references in number order, with what a citation's hover
    // card shows. BO_0291_026 BO_0291_027
    method: "GET",
    path: "references",
    handle: async (event) => {
      const id = event.url.searchParams.get("document") ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such document");
      const { status, body } = respond(await referencesOf(id));
      event.json(status, body);
    },
  },
  {
    method: "POST",
    path: "fetch",
    handle: async (event) => {
      const body = record(await event.request.json().catch(() => ({})));
      let ask: FetchAsk | null = null;
      if (typeof body["input"] === "string" && body["input"].trim() !== "") ask = askOf(body["input"]);
      const selection = record(body["selection"]);
      if (typeof selection["session"] === "string" && typeof selection["url"] === "string" && typeof selection["items"] === "object" && selection["items"] !== null) {
        ask = { selection: { url: selection["url"], session: selection["session"], items: selection["items"] as Record<string, string> } };
      }
      if (ask === null) {
        event.json(400, { outcome: "refused", detail: "a fetch carries an input — a DOI, an ISBN, a PMID, an arXiv id or a URL — or a selection" });
        return;
      }
      const answered = await fetchRecord(ask);
      event.json(answered.outcome === "refused" ? 422 : 200, answered);
    },
  },
];

/**
 * What the kernel calls (`BO_0291_021`): a run's `propose_work` and
 * `read_works`, and the executable migration it runs once per instance as it
 * serves the pin that carries the member (`BO_0313_023`), answering the
 * kernel alone.
 */
const kernelRoutes: readonly ApiRoute[] = [
  {
    method: "POST",
    path: "kernel/tools/[tool]",
    kernelCallback: true,
    handle: async (event, params) => {
      const tool = TOOLS[params["tool"] as keyof typeof TOOLS];
      if (tool === undefined) throw new HttpError(404, `bibliography answers no tool ${params["tool"] ?? ""}`);
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
    method: "POST",
    path: "kernel/migrations/[migration]",
    kernelCallback: true,
    handle: async (event, params) => {
      const migration = MIGRATIONS[params["migration"] ?? ""];
      if (migration === undefined) throw new HttpError(404, `bibliography runs no migration ${params["migration"] ?? ""}`);
      const answer = await migration();
      if (answer.outcome !== "success") throw new HttpError(502, `the migration could not read the graph: ${answer.outcome}`);
      event.json(200, answer.result);
    },
  },
];

export const contributions = declare({
  routes: [...routes, ...kernelRoutes],
  // How a document's citations read in its style, asked by `documents`'
  // read. BO_0291_030
  citations: (request) => labelsFor(request),
});
