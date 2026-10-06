import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { adoptFocusedWork } from "~/server/focused-work";

/**
 * Adopts an existing child as the focused work of a new block of the target
 * (`documents`' `DO_0043_001`): a document dropped into a document. The kind
 * names which contribution plans the block, the placement is the view's in
 * that kind's own terms, and `into` names the block a nest landed on.
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const itemId = event.params["item"] ?? "";
    const body = (await event.request.json()) as { kind?: unknown; childId?: unknown; placement?: unknown; into?: unknown };
    const kind = typeof body.kind === "string" ? body.kind : "";
    const childId = typeof body.childId === "string" ? body.childId : "";
    if (childId === "") {
      event.json(400, { error: "an adoption names the child it adopts" });
      return;
    }
    event.json(
      200,
      await adoptFocusedWork({
        kind,
        targetId: itemId,
        childId,
        ...(body.placement === undefined ? {} : { placement: body.placement }),
        ...(typeof body.into === "string" ? { into: body.into } : {}),
      }),
    );
  });
