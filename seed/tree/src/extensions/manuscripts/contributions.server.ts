import { serverContributions as declare, type ApiRoute } from "~/contract";
import { blobHash, readBlob } from "~/server/ccgw/blobs";
import { HttpError } from "~/server/http-error";
import { respond } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";

import { MIGRATIONS } from "./server/migrations";
import { listRenditions, readRendition } from "./server/renditions";
import { keptForKernel, projectForKernel, ToolRefusal, type ToolCall } from "./server/tools";

/**
 * The server half of `manuscripts` (`BO_0293_021`, `calliopa-bootstrap`'s
 * `BO_0312_020`–`BO_0312_023`): a document's kept renditions, each one's
 * files streamed back typed and named, the two routes the kernel calls for a
 * run's `make_manuscript`, and the migration that makes manuscripts formats.
 * Only server code imports this module.
 */

const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

const routes: readonly ApiRoute[] = [
  {
    // A document's renditions, newest first, drawn at its end. BO_0312_022,
    // BO_0332_031
    method: "GET",
    path: "renditions",
    handle: async (event) => {
      const of = event.url.searchParams.get("document") ?? "";
      if (!isRecordId(of)) throw new HttpError(400, "renditions are read by their document, named by its id");
      const listed = await listRenditions(of);
      if (listed.outcome !== "success") {
        event.json(502, listed);
        return;
      }
      event.json(200, { renditions: listed.result });
    },
  },
  {
    method: "GET",
    path: "renditions/[id]",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such rendition");
      const { status, body } = respond(await readRendition(id));
      event.json(status, body);
    },
  },
  {
    // One of a rendition's files, typed and named as it was kept: the PDF
    // shown in the browser, the source and the .bib downloaded. Immutable,
    // since a kept rendition never changes. BO_0312_022
    method: "GET",
    path: "renditions/[id]/files/[name]",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such rendition");
      const rendition = await readRendition(id);
      if (rendition.outcome !== "success") throw new HttpError(404, "no such rendition");
      const file = rendition.result.files.find((candidate) => candidate.filename === params["name"]);
      if (file === undefined) throw new HttpError(404, "this rendition holds no such file");
      let bytes: Uint8Array;
      try {
        bytes = await readBlob(blobHash(file.objectId));
      } catch {
        throw new HttpError(404, "the file could not be read");
      }
      const binary = file.mediaType === "application/pdf" || file.mediaType.startsWith("image/");
      event.headers.set("Content-Type", binary ? file.mediaType : `${file.mediaType}; charset=utf-8`);
      event.headers.set("Content-Disposition", `${file.mediaType === "application/pdf" ? "inline" : "attachment"}; filename="${file.filename}"`);
      event.cacheControl({ maxAge: 31536000, public: false, immutable: true });
      event.send(200, bytes);
    },
  },
  {
    // What the kernel calls for a run's make_manuscript (BO_0293_023,
    // BO_0312_020, BO_0332_030): the document carrying Format projected whole at the run's pin with
    // the roles the run names, ready for the service. Answered only with the
    // callback secret, as every kernelCallback route is.
    method: "POST",
    path: "kernel/manuscripts/project",
    kernelCallback: true,
    handle: async (event) => {
      try {
        event.json(200, await projectForKernel(await toolCallOf(event.request)));
      } catch (error) {
        if (error instanceof ToolRefusal) throw new HttpError(422, error.message);
        throw error;
      }
    },
  },
  {
    // The kept rendition composed from what the service answered and the
    // files the kernel put, as statements the kernel stages into the run's
    // group. BO_0293_023 BO_0312_021
    method: "POST",
    path: "kernel/manuscripts/kept",
    kernelCallback: true,
    handle: async (event) => {
      try {
        event.json(200, keptForKernel(await toolCallOf(event.request)));
      } catch (error) {
        if (error instanceof ToolRefusal) throw new HttpError(422, error.message);
        throw error;
      }
    },
  },
  {
    // The executable migration (BO_0312_023): the kernel posts here once per
    // instance when it serves the pin carrying the member.
    method: "POST",
    path: "kernel/migrations/[migration]",
    kernelCallback: true,
    handle: async (event, params) => {
      const migration = MIGRATIONS[params["migration"] ?? ""];
      if (migration === undefined) throw new HttpError(404, `manuscripts runs no migration ${params["migration"] ?? ""}`);
      const answer = await migration();
      if (answer.outcome !== "success") throw new HttpError(502, `the migration could not read the graph: ${"detail" in answer ? String(answer.detail) : answer.outcome}`);
      event.json(200, answer.result);
    },
  },
];

/** What the kernel posted: the input and the run. */
async function toolCallOf(request: Request): Promise<ToolCall> {
  const body = record(await request.json().catch(() => ({})));
  return { input: record(body["input"]), run: (body["run"] ?? { id: "", group: "", pin: 0 }) as ToolCall["run"] };
}

export const contributions = declare({ routes });
