import {
  serverContributions as declare,
  type ApiRoute,
  type LibraryItem,
} from "~/contract";
import {
  handleDocumentChanges,
  handleDocumentCommand,
  handleDocumentCreate,
  handleDocumentList,
  handleDocumentRead,
  handleProposalsRead,
  handleRetiredRead,
  unknownDocument,
  handleReadMark,
  handleBranchRead,
  handlePolicyRead,
  handleStandingRead,
  handleTableFile,
} from "./server/api";
import { withBranch } from "~/server/ccgw/branch-scope";
import { listDocuments } from "./server/documents";
import { documentItem } from "./lib/library-item";
import { glyphsFor } from "~/server/registry";
import { documentFocusedWork } from "./server/focus";
import { proposedDocuments } from "./server/proposed";
import { isRecordId } from "~/server/uuid";

/**
 * The server half of `documents`: the reader behind its library section and
 * its handler table under `/api/x/documents/`. The route names are the
 * extension's own, so a document is `d/[id]` rather than `documents/[id]`,
 * where the repetition reads badly. Only the server imports this module.
 * BO_0255_006
 */

/** A document route names a record identifier or is answered as a missing document. */
const document =
  (
    handle: (id: string) => Promise<{ status: number; body: unknown }>,
  ): ApiRoute["handle"] =>
  async (event, params) => {
    const id = params["id"] ?? "";
    // A tab in a branch reads the document through it: `?branch=` on every
    // document read names the group the reads overlay. BO_0250_011
    const branch = new URL(event.request.url).searchParams.get("branch") ?? undefined;
    const { status, body } = isRecordId(id)
      ? await withBranch(branch, () => handle(id))
      : unknownDocument(id);
    event.json(status, body);
  };

const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "d",
    handle: async (event) => {
      const { status, body } = await handleDocumentList();
      event.json(status, body);
    },
  },
  {
    method: "POST",
    path: "d",
    handle: async (event) => {
      const { status, body } = await handleDocumentCreate(event.request);
      event.json(status === 200 ? 201 : status, body);
    },
  },
  {
    method: "GET",
    path: "d/[id]",
    handle: document(handleDocumentRead),
  },
  {
    method: "GET",
    path: "d/[id]/changes",
    handle: document(handleDocumentChanges),
  },
  {
    method: "GET",
    path: "d/[id]/proposals",
    handle: document(handleProposalsRead),
  },
  {
    method: "GET",
    path: "d/[id]/retired",
    handle: document(handleRetiredRead),
  },
  {
    /** The signed-in person's read mark on the document. BO_0246_009 */
    method: "GET",
    path: "d/[id]/read",
    handle: (event, params) => document((id) => handleReadMark(event.request, id))(event, params),
  },
  {
    method: "PUT",
    path: "d/[id]/read",
    handle: (event, params) => document((id) => handleReadMark(event.request, id))(event, params),
  },
  {
    /** The signed-in person's branch on the document. BO_0250_020 */
    method: "GET",
    path: "d/[id]/branch",
    handle: document(handleBranchRead),
  },
  {
    /** Whether every edit goes into the person's proposal. BO_0212_011 */
    method: "GET",
    path: "d/[id]/policy",
    handle: document(handlePolicyRead),
  },
  {
    /** The branch's standing against head, per member. BO_0250_021 */
    method: "GET",
    path: "d/[id]/standing",
    handle: (event, params) => document((id) => handleStandingRead(event.request, id))(event, params),
  },
  {
    /** The bytes of a file a table stands behind, answered as the blob
     * reference the insert carries. BO_0287_013 */
    method: "POST",
    path: "blobs",
    handle: async (event) => {
      const { status, body } = await handleTableFile(event.request);
      event.json(status, body);
    },
  },
  {
    method: "POST",
    path: "d/[id]/commands",
    handle: (event, params) =>
      document((id) => handleDocumentCommand(event.request, id))(event, params),
  },
];

export const contributions = declare({
  readers: {
    // A document as the library lists it is its identity and its title; the
    // listing carries nothing else, so opening the drawer never reads block
    // content the section does not render.
    // A document under pressure or needing review carries the glyph that
    // says so, derived from its judgements at listing time. BO_0248_012
    documents: async (): Promise<readonly LibraryItem[]> => {
      const outcome = await listDocuments();
      if (outcome.outcome !== "success") return [];
      // What a document is marked with is whatever an extension has to say
      // about it; this one lists documents and says nothing. BO_0256_008
      const glyphs = await glyphsFor("document");
      // A document a run started and nobody has taken says who proposed it.
      // BO_0251_011
      return outcome.result.map((entry) => documentItem(entry, glyphs[entry.documentId]));
    },
  },
  routes,
  // What a run staged into this extension's documents, for the frame's run
  // detail. BO_0255_007
  proposedTargets: proposedDocuments,
  // How a child of a document is made and read, so the shell can open any
  // block of one as focused work without writing this vocabulary itself.
  // CA_0065_008
  focusedWork: { document: documentFocusedWork },
});
