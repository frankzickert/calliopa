import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { facesOf, openFocusedWork } from "~/server/focused-work";

/**
 * Focused work on one target, the frame's own endpoint (`CA_0065_003`).
 *
 * The capability is the shell's, so the route is too: a view asks through the
 * bridge and never through the extension that owns the target's vocabulary.
 * The kind names which contribution answers, because what a child of a target
 * is belongs to the extension that contributes the kind.
 *
 * `GET` answers the face of every block of the target that has focused work;
 * `POST` opens one block as focused work, or answers the child that already
 * focuses it.
 */

export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const itemId = event.params["item"] ?? "";
    const kind = new URL(event.request.url).searchParams.get("kind") ?? "";
    event.json(200, await facesOf(kind, itemId));
  });

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const itemId = event.params["item"] ?? "";
    const body = (await event.request.json()) as { kind?: unknown; blockId?: unknown };
    const kind = typeof body.kind === "string" ? body.kind : "";
    const blockId = typeof body.blockId === "string" ? body.blockId : "";
    if (blockId === "") {
      event.json(400, { error: "focused work names the block it opens" });
      return;
    }
    event.json(200, await openFocusedWork({ kind, targetId: itemId, blockId }));
  });
