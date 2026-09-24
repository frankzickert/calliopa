import { serverContributions as declare, type ApiRoute } from "~/contract";
import { withBranch } from "~/server/ccgw/branch-scope";
import { blobHash, readBlob } from "~/server/ccgw/blobs";
import { HttpError } from "~/server/http-error";
import { respond } from "~/server/outcome";
import { readSession } from "~/server/session";
import { isRecordId } from "~/server/uuid";

import type { ManuscriptView } from "./lib/manuscript";
import { makeManuscript, readVenues } from "./server/make";
import { listManuscripts, readManuscript } from "./server/manuscripts";

/**
 * The server half of `manuscripts` (`BO_0293_021`): the venues the
 * typesetting service carries, the make — a person's press, projecting the
 * document and keeping what came back — the kept manuscripts, all or a
 * document's, and each one's files streamed back typed and named. Only server
 * code imports this module.
 */

/** What the Manuscripts section is handed: the kept manuscripts, or that the
 * graph did not answer. */
export interface ManuscriptsListing {
  readonly reachable: boolean;
  readonly manuscripts: readonly ManuscriptView[];
}

const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

const readers = {
  manuscripts: async (): Promise<ManuscriptsListing> => {
    const listed = await listManuscripts();
    return listed.outcome === "success" ? { reachable: true, manuscripts: listed.result } : { reachable: false, manuscripts: [] };
  },
};

const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "venues",
    handle: async (event) => {
      event.json(200, await readVenues());
    },
  },
  {
    // A person's press on *Make manuscript*: the document projected as it
    // reads now, in the tab's branch when it is in one. BO_0293_021
    method: "POST",
    path: "make",
    handle: async (event) => {
      const body = record(await event.request.json().catch(() => ({})));
      const documentId = typeof body["document"] === "string" ? body["document"] : "";
      if (!isRecordId(documentId)) throw new HttpError(400, "a manuscript is made of a document, named by its id");
      const venue = typeof body["venue"] === "string" && body["venue"] !== "" ? body["venue"] : undefined;
      const branch = typeof body["branch"] === "string" && body["branch"] !== "" ? body["branch"] : undefined;
      const person = await readSession();
      const { status, body: answer } = respond(
        await withBranch(branch, () => makeManuscript({ documentId, ...(venue === undefined ? {} : { venue }), by: person?.name ?? "" })),
      );
      event.json(status, answer);
    },
  },
  {
    method: "GET",
    path: "manuscripts",
    handle: async (event) => {
      const of = event.url.searchParams.get("document") ?? undefined;
      if (of !== undefined && !isRecordId(of)) throw new HttpError(400, "a document is named by its id");
      const listed = await listManuscripts(of);
      if (listed.outcome !== "success") {
        event.json(502, listed);
        return;
      }
      event.json(200, { manuscripts: listed.result });
    },
  },
  {
    method: "GET",
    path: "manuscripts/[id]",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such manuscript");
      const { status, body } = respond(await readManuscript(id));
      event.json(status, body);
    },
  },
  {
    // One of a manuscript's files, typed and named as it was kept: the PDF
    // shown in the browser, the source and the .bib downloaded. Immutable,
    // since a kept manuscript never changes. BO_0293_021
    method: "GET",
    path: "manuscripts/[id]/files/[name]",
    handle: async (event, params) => {
      const id = params["id"] ?? "";
      if (!isRecordId(id)) throw new HttpError(404, "no such manuscript");
      const manuscript = await readManuscript(id);
      if (manuscript.outcome !== "success") throw new HttpError(404, "no such manuscript");
      const file = manuscript.result.files.find((candidate) => candidate.filename === params["name"]);
      if (file === undefined) throw new HttpError(404, "this manuscript holds no such file");
      let bytes: Uint8Array;
      try {
        bytes = await readBlob(blobHash(file.objectId));
      } catch {
        throw new HttpError(404, "the file could not be read");
      }
      event.headers.set("Content-Type", file.mediaType === "application/pdf" ? "application/pdf" : `${file.mediaType}; charset=utf-8`);
      event.headers.set("Content-Disposition", `${file.mediaType === "application/pdf" ? "inline" : "attachment"}; filename="${file.filename}"`);
      event.cacheControl({ maxAge: 31536000, public: false, immutable: true });
      event.send(200, bytes);
    },
  },
];

export const contributions = declare({ routes, readers });
