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
import {
  declaresVocabulary,
  listExtensions,
  readExtensionDocument,
} from "~/server/extensions";
import { HttpError } from "~/server/http-error";
import { kernelExtensions } from "~/server/kernel/extensions";
import { readSession } from "~/server/session";
import { isRecordId } from "~/server/uuid";

/**
 * The server half of `ui.shell`'s contributions: the readers behind its two
 * library sections and its handler table under `/api/x/ui.shell/` — documents
 * and extensions. Episodes, fronts, standing assets and the two channels are
 * `calliopa-video`'s since `BO_0203`. Only the server imports this module.
 * BO_0202_002 BO_0202_005 BO_0202_006
 */

/** A document route names a record identifier or is answered as a missing document. */
const document =
  (
    handle: (id: string) => Promise<{ status: number; body: unknown }>,
  ): ApiRoute["handle"] =>
  async (event, params) => {
    const id = params["id"] ?? "";
    const { status, body } = isRecordId(id)
      ? await handle(id)
      : unknownDocument(id);
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
  {
    method: "GET",
    path: "documents/[id]",
    handle: document(handleDocumentRead),
  },
  {
    method: "GET",
    path: "documents/[id]/changes",
    handle: document(handleDocumentChanges),
  },
  {
    method: "GET",
    path: "documents/[id]/proposals",
    handle: document(handleProposalsRead),
  },
  {
    method: "GET",
    path: "documents/[id]/retired",
    handle: document(handleRetiredRead),
  },
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
     * A new extension: the kernel writes its manifest and system.md as truth
     * under the signed-in person, and answers its view. The refusal — an
     * invalid id, a taken id, an agent-class session — passes through with
     * its code so the form can say it. BO_0224_009
     */
    method: "POST",
    path: "extensions",
    handle: (event) =>
      kernelAnswer(event, async () => {
        const body = (await event.request.json()) as { id?: unknown; purpose?: unknown };
        if (typeof body.id !== "string" || typeof body.purpose !== "string") {
          throw new HttpError(400, 'the body must carry "id" and "purpose"', "bad_request");
        }
        return kernelExtensions.create(body.id.trim(), body.purpose.trim());
      }, 201),
  },
  {
    /**
     * An import staged as a proposal: the body is the archive's bytes, sent
     * raw to the kernel with the file's name, and the answer is the group and
     * the summary — or the kernel's refusal with its code (`forbidden` for
     * anyone but the owner, `extension_reserved`, `nothing_to_import`,
     * `import_refused`, `archive_invalid`, `archive_too_large`). BO_0224_011
     */
    method: "POST",
    path: "extensions/import",
    handle: (event) =>
      kernelAnswer(event, async () => {
        const name = event.url.searchParams.get("name") ?? "extension.zip";
        const bytes = new Uint8Array(await event.request.arrayBuffer());
        return kernelExtensions.importArchive(bytes, name);
      }, 202),
  },
  {
    /** A staged import again, with its group's state. BO_0224_011 */
    method: "GET",
    path: "extensions/import/[group]",
    handle: (event, params) =>
      kernelAnswer(event, () => kernelExtensions.importRecord(params["group"] ?? "")),
  },
  {
    /**
     * The owner's decision on an import's group: accept parks behind the
     * kernel's confirmation and answers its address; reject executes.
     * BO_0224_011
     */
    method: "POST",
    path: "extensions/import/[group]/[verb]",
    handle: (event, params) =>
      kernelAnswer(event, async () => {
        const verb = params["verb"];
        if (verb !== "accept" && verb !== "reject") {
          throw new HttpError(404, "an import is accepted or rejected", "not_found");
        }
        const group = params["group"] ?? "";
        const body = (await event.request.json().catch(() => ({}))) as { id?: unknown; version?: unknown };
        const named = typeof body.id === "string" ? `${body.id}${typeof body.version === "string" ? ` ${body.version}` : ""}` : group;
        return kernelExtensions.decide(verb, group, `extension import ${verb === "accept" ? "accepted" : "rejected"} in the browser: ${named}`);
      }),
  },
  {
    /** Head promoted through the gate: an update's Serve now. BO_0224_011 */
    method: "POST",
    path: "extensions/promote",
    handle: (event) => kernelAnswer(event, () => kernelExtensions.promote(), 202),
  },
  {
    /**
     * One extension as an archive, streamed from the kernel with its file
     * name, so the browser downloads it; `?revision=` names one of the
     * extension's versions. BO_0224_010
     */
    method: "GET",
    path: "extensions/[id]/export",
    handle: async (event, params) => {
      const raw = event.url.searchParams.get("revision");
      const revision = raw === null ? undefined : Number(raw);
      if (revision !== undefined && (!Number.isInteger(revision) || revision <= 0)) {
        throw new HttpError(400, "revision must be a positive integer", "bad_request");
      }
      const archive = await kernelExtensions.exportArchive(params["id"] ?? "", revision);
      event.headers.set("content-type", "application/zip");
      event.headers.set("content-disposition", `attachment; filename="${archive.fileName}"`);
      event.send(200, archive.bytes);
    },
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
      event.json(
        outcome.outcome === "unreachable"
          ? 503
          : outcome.outcome === "missing"
            ? 404
            : 200,
        outcome,
      );
    },
  },
  {
    /**
     * How one extension is served, as the kernel answers it — active,
     * required, pinned, its versions — with the kernel's own state for the
     * rebuild the view watches and whether the extension declares members a
     * flip never pins. BO_0218_009 BO_0219_006
     */
    method: "GET",
    path: "extensions/[id]/state",
    handle: (event, params) =>
      kernelAnswer(event, async () => {
        const id = params["id"] ?? "";
        const [listing, health, vocabulary] = await Promise.all([
          kernelExtensions.list(),
          kernelExtensions.health().catch(() => null),
          declaresVocabulary(id),
        ]);
        const extension = listing.extensions.find(
          (candidate) => candidate.id === id,
        );
        if (extension === undefined)
          throw new HttpError(
            404,
            `no extension ${id} is established`,
            "extension_unknown",
          );
        return {
          extension,
          required: listing.required,
          head: listing.head,
          servedPin: listing.servedPin ?? null,
          promotion: listing.promotion ?? null,
          canChange: listing.canChange,
          declaresVocabulary: vocabulary,
          health,
        };
      }),
  },
  {
    /** Switch an extension off or on: the kernel writes the state and promotes head. BO_0218_009 */
    method: "POST",
    path: "extensions/[id]/state",
    handle: (event, params) =>
      kernelAnswer(event, async () => {
        const body = (await event.request.json()) as { active?: unknown };
        if (typeof body.active !== "boolean")
          throw new HttpError(
            400,
            'the body must carry "active": true or false',
            "bad_request",
          );
        return kernelExtensions.setActive(params["id"] ?? "", body.active);
      }),
  },
  {
    /** Serve an extension at one of its versions, or let it follow the release pin again. BO_0219_006 */
    method: "POST",
    path: "extensions/[id]/version",
    handle: (event, params) =>
      kernelAnswer(event, async () => {
        const body = (await event.request.json()) as {
          revision?: unknown;
          follow?: unknown;
        };
        if (body.follow === true)
          return kernelExtensions.setVersion(params["id"] ?? "", {
            follow: true,
          });
        if (typeof body.revision !== "number" || body.revision <= 0) {
          throw new HttpError(
            400,
            'the body must carry "revision": N or "follow": true',
            "bad_request",
          );
        }
        return kernelExtensions.setVersion(params["id"] ?? "", {
          revision: body.revision,
        });
      }),
  },
];

/**
 * Answers a kernel call's result, or the kernel's refusal with its code so
 * the view can show it as what it is: `extension_required`,
 * `extension_has_dependents`, `human_only`, `promotion_running`.
 */
async function kernelAnswer(
  event: Parameters<ApiRoute["handle"]>[0],
  run: () => Promise<unknown>,
  status = 200,
): Promise<void> {
  try {
    event.json(status, await run());
  } catch (error) {
    if (error instanceof HttpError) {
      event.json(error.status, {
        code: error.code ?? "kernel_refused",
        message: error.message,
      });
      return;
    }
    event.json(503, { code: "kernel_unreachable", message: String(error) });
  }
}

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
        open: {
          kind: "document",
          itemId: document.documentId,
          title: document.title,
        },
      }));
    },
    // The knowledge graph's extensions, or why they could not be read; the
    // section's component renders either. BO_0201_005 The reader adds whether
    // the person is the owner, for the import control, outside the snapshot's
    // cache. BO_0224_011
    extensions: async () => {
      const listing = await listExtensions();
      if (!listing.reachable) return listing;
      const person = await readSession();
      return { ...listing, owner: person?.owner === true };
    },
  },
  routes,
});
