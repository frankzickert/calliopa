import { serverContributions as declare, type ApiRoute } from "~/contract";
import {
  declaresVocabulary,
  isElevated,
  listExtensions,
  readExtensionDocument,
} from "~/server/extensions";
import { HttpError } from "~/server/http-error";
import { kernelExtensions } from "~/server/kernel/extensions";
import { readSession } from "~/server/session";

/**
 * The server half of `ui.shell`'s contributions: the reader behind its
 * Extensions section and its handler table under `/api/x/ui.shell/`, which is
 * extension administration and nothing else. Documents left for the
 * `documents` extension under `BO_0255`, as episodes and publishing left for
 * `calliopa-video` under `BO_0203`. Only the server imports this module.
 * BO_0202_002 BO_0202_005 BO_0202_006 BO_0255_006
 */

const routes: readonly ApiRoute[] = [
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
    /**
     * The person's decision on any group touching an extension: accept
     * parks behind the kernel's confirmation and answers its address;
     * reject executes. The same posture as an import's decision — the shell
     * never accepts a group itself. BO_0282_008
     */
    method: "POST",
    path: "extensions/group/[group]/[verb]",
    handle: (event, params) =>
      kernelAnswer(event, async () => {
        const verb = params["verb"];
        if (verb !== "accept" && verb !== "reject") {
          throw new HttpError(404, "a group is accepted or rejected", "not_found");
        }
        const group = params["group"] ?? "";
        const body = (await event.request.json().catch(() => ({}))) as { rationale?: unknown };
        const rationale =
          typeof body.rationale === "string" && body.rationale !== ""
            ? body.rationale
            : `${verb === "accept" ? "accepted" : "rejected"} in the browser: ${group}`;
        return kernelExtensions.decide(verb, group, rationale);
      }),
  },
  {
    /** Build and serve a staged group beside the instance, or stop it. BO_0282_010 */
    method: "POST",
    path: "extensions/candidate",
    handle: (event) =>
      kernelAnswer(event, async () => {
        const body = (await event.request.json()) as { group?: unknown; stop?: unknown };
        if (body.stop === true) return kernelExtensions.stopCandidate();
        if (typeof body.group !== "string" || body.group === "")
          throw new HttpError(400, 'the body must carry "group", or "stop": true', "bad_request");
        return kernelExtensions.startCandidate(body.group);
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
        // The kernel's one-extension read, never the listing: a person
        // looking at one extension waits on that extension alone. BO_0257_009
        const [listing, health, vocabulary, elevated] = await Promise.all([
          kernelExtensions.one(id),
          kernelExtensions.health().catch(() => null),
          declaresVocabulary(id),
          isElevated(id),
        ]);
        return {
          extension: listing.extension,
          required: listing.required,
          head: listing.head,
          servedPin: listing.servedPin ?? null,
          promotion: listing.promotion ?? null,
          canChange: listing.canChange,
          declaresVocabulary: vocabulary,
          elevated,
          health,
          autonomous: listing.autonomous === true,
          declaresTrigger: listing.declaresTrigger === true,
          isOwner: listing.isOwner === true,
        };
      }),
  },
  {
    /** Allow an extension to start runs on its own, or withdraw it: the owner's alone, and nothing is rebuilt. BO_0264_018 */
    method: "POST",
    path: "extensions/[id]/autonomous",
    handle: (event, params) =>
      kernelAnswer(event, async () => {
        const body = (await event.request.json()) as { allowed?: unknown };
        if (typeof body.allowed !== "boolean")
          throw new HttpError(400, 'the body must carry "allowed": true or false', "bad_request");
        return kernelExtensions.setAutonomous(params["id"] ?? "", body.allowed);
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
  {
    /**
     * The open groups touching this extension, each with what a person
     * judges it by — the change document and its staged status, what it
     * touches, the runs and their gates. No diff: the shell shows no code
     * (`contribution-contract.md`, Not Here). BO_0282_008
     */
    method: "GET",
    path: "extensions/[id]/groups",
    handle: (event, params) =>
      kernelAnswer(event, async () => {
        const id = params["id"] ?? "";
        const [groups, candidate] = await Promise.all([
          kernelExtensions.groups(id),
          kernelExtensions.candidate().catch(() => ({ running: false })),
        ]);
        return { ...groups, candidate };
      }),
  },
  {
    /** One group, which additionally counts the files it touches. BO_0282_008 */
    method: "GET",
    path: "extensions/[id]/groups/[group]",
    handle: (event, params) =>
      kernelAnswer(event, () =>
        kernelExtensions.group(params["id"] ?? "", params["group"] ?? ""),
      ),
  },
  {
    /**
     * Move a change document's status. The shell writes nothing: the kernel
     * stages the one-line edit and the person's acceptance establishes it,
     * which is what keeps acceptance the single non-delegable human action.
     * BO_0282_009
     */
    method: "POST",
    path: "extensions/[id]/change-status",
    handle: (event, params) =>
      kernelAnswer(event, async () => {
        const body = (await event.request.json()) as { path?: unknown; status?: unknown };
        if (typeof body.path !== "string" || body.path === "")
          throw new HttpError(400, 'the body must carry "path": the change document\'s member path', "bad_request");
        if (typeof body.status !== "string" || body.status === "")
          throw new HttpError(400, 'the body must carry "status": the status to move to', "bad_request");
        return kernelExtensions.setChangeStatus(params["id"] ?? "", body.path, body.status);
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
