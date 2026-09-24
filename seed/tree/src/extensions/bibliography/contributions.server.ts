import { serverContributions as declare, type ApiRoute } from "~/contract";
import { blobReference, isBlobReference, objectIdOfHash, putBlob, readBlob } from "~/server/ccgw/blobs";
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
import { listWorks, readWork, setWorkFile, type WorkView } from "./server/works";

/**
 * The server half of `bibliography` (`BO_0291_016`–`BO_0291_019`): its own
 * command route under `/api/x/bibliography/`, the fetch of a record through
 * the kernel forward, the bibliography's works for the Sources section and
 * the work view, and a work's file — uploaded through this origin as a
 * picture is, since the browser cannot reach `PUT /v1/blobs`, and streamed
 * back typed as the PDF it is. Only server code imports this module.
 */

/** What the Sources section is handed: the works, or that the graph did not answer. */
export interface SourcesListing {
  readonly reachable: boolean;
  readonly works: readonly WorkView[];
}

const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

const MAX_FILE_BYTES = 64 * 1024 * 1024;

const readers = {
  sources: async (): Promise<SourcesListing> => {
    const listed = await listWorks();
    return listed.outcome === "success" ? { reachable: true, works: listed.result } : { reachable: false, works: [] };
  },
};

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
      if (!isRecordId(id)) throw new HttpError(404, "no such work");
      const { status, body } = respond(await readWork(id));
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
      if (!isRecordId(id)) throw new HttpError(404, "no such work");
      const { status, body } = respond(await documentsCiting(id));
      event.json(status, body);
    },
  },
  {
    // The file arrives as the request body with its type and name in
    // headers, as a table's file does (`documents`' `blobs` route), and is
    // set on the work against the base revision the tab read. BO_0291_018
    method: "POST",
    path: "works/[id]/file",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such work");
      const base = event.request.headers.get("x-calliopa-base-revision") ?? "";
      const mediaType = event.request.headers.get("content-type") ?? "application/pdf";
      const filename = decodeURIComponent(event.request.headers.get("x-calliopa-filename") ?? "") || "file.pdf";
      if (!mediaType.startsWith("application/pdf")) throw new HttpError(400, "a work's file is a PDF");
      const bytes = new Uint8Array(await event.request.arrayBuffer());
      if (bytes.length === 0) throw new HttpError(400, "the file is empty");
      if (bytes.length > MAX_FILE_BYTES) throw new HttpError(413, "the file is larger than 64 MiB");
      const stored = await putBlob(bytes);
      if (stored.outcome !== "success") {
        const { status, body } = respond(stored);
        event.json(status, body);
        return;
      }
      const objectId = objectIdOfHash(stored.result.hash);
      if (objectId === null) throw new HttpError(502, "the store answered no object for the file");
      const file = { ...blobReference(objectId, "application/pdf", stored.result.size), filename };
      const { status, body } = respond(await setWorkFile({ workId: id, baseRevisionId: base, file }));
      event.json(status, body);
    },
  },
  {
    method: "DELETE",
    path: "works/[id]/file",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such work");
      const base = event.request.headers.get("x-calliopa-base-revision") ?? "";
      const { status, body } = respond(await setWorkFile({ workId: id, baseRevisionId: base, file: null }));
      event.json(status, body);
    },
  },
  {
    // The work's file, typed as the PDF it is, the way `calliopa-refine`
    // serves a captured page's PDF: the generic blob route answers every
    // object as octet-stream by the mirror rule. BO_0291_018
    method: "GET",
    path: "works/[id]/file",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such work");
      const work = await readWork(id);
      if (work.outcome !== "success") throw new HttpError(404, "no such work");
      const reference = work.result.record.file;
      if (reference === undefined || !isBlobReference(reference)) throw new HttpError(404, "this work holds no file");
      let bytes: Uint8Array;
      try {
        bytes = await readBlob(reference.hash);
      } catch {
        throw new HttpError(404, "the work's file could not be read");
      }
      const name = typeof (reference as { filename?: unknown }).filename === "string" ? String((reference as { filename?: string }).filename) : `${work.result.record.title}.pdf`;
      event.headers.set("Content-Type", "application/pdf");
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
 * `read_works`, answering the kernel alone.
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
];

export const contributions = declare({
  routes: [...routes, ...kernelRoutes],
  readers,
  // How a document's citations read in its style, asked by `documents`'
  // read. BO_0291_030
  citations: (request) => labelsFor(request),
});
