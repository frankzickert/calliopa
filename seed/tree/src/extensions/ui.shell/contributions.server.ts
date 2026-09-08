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
} from "~/server/documents/api";
import { listDocuments } from "~/server/documents/documents";
import { listExtensions, readExtensionDocument } from "~/server/extensions";
import { isRecordId } from "~/server/uuid";

/**
 * The server half of `ui.shell`'s contributions: the readers behind its two
 * library sections and its handler table under `/api/x/ui.shell/` — documents
 * and extensions. Episodes, fronts, standing assets and the two channels are
 * `calliopa-video`'s since `BO_0203`. Only the server imports this module.
 * BO_0202_002 BO_0202_005 BO_0202_006
 */

/** A document route names a record identifier or is answered as a missing document. */
const document = (
  handle: (id: string) => Promise<{ status: number; body: unknown }>,
): ApiRoute["handle"] =>
  async (event, params) => {
    const id = params["id"] ?? "";
    const { status, body } = isRecordId(id) ? await handle(id) : unknownDocument(id);
    event.json(status, body);
  };

const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "documents",
    handle: async (event) => {
      const { status, body } = await handleDocumentList();
      event.json(status, body);
    },
  },
  {
    method: "POST",
    path: "documents",
    handle: async (event) => {
      const { status, body } = await handleDocumentCreate(event.request);
      event.json(status === 200 ? 201 : status, body);
    },
  },
  { method: "GET", path: "documents/[id]", handle: document(handleDocumentRead) },
  { method: "GET", path: "documents/[id]/changes", handle: document(handleDocumentChanges) },
  { method: "GET", path: "documents/[id]/proposals", handle: document(handleProposalsRead) },
  { method: "GET", path: "documents/[id]/retired", handle: document(handleRetiredRead) },
  {
    method: "POST",
    path: "documents/[id]/commands",
    handle: (event, params) =>
      document((id) => handleDocumentCommand(event.request, id))(event, params),
  },
  {
    /** The extensions the graph holds, as the library lists them. BO_0201_005 */
    method: "GET",
    path: "extensions",
    handle: async (event) => event.json(200, await listExtensions()),
  },
  {
    /**
     * One node of an extension's owner network as a document: the extension
     * itself, or — with `?path=` — one of its topics or changes. BO_0201_007
     */
    method: "GET",
    path: "extensions/[id]",
    handle: async (event, params) => {
      const path = event.url.searchParams.get("path") ?? undefined;
      const outcome = await readExtensionDocument(params["id"] ?? "", path);
      event.json(outcome.outcome === "unreachable" ? 503 : outcome.outcome === "missing" ? 404 : 200, outcome);
    },
  },
];

export const contributions = declare({
  readers: {
    // A document as the library lists it is its identity and its title; the
    // listing carries nothing else, so opening the drawer never reads block
    // content the section does not render.
    documents: async (): Promise<readonly LibraryItem[]> => {
      const outcome = await listDocuments();
      if (outcome.outcome !== "success") return [];
      return outcome.result.map((document) => ({
        id: document.documentId,
        label: document.title,
        open: { kind: "document", itemId: document.documentId, title: document.title },
      }));
    },
    // The knowledge graph's extensions, or why they could not be read; the
    // section's component renders either. BO_0201_005
    extensions: () => listExtensions(),
  },
  routes,
});
