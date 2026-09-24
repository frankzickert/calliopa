import type { RequestHandler } from "@builder.io/qwik-city";

import { api } from "~/server/api";
import { quoteSender, senderExtension } from "~/server/registry";

/**
 * What a command to a sender would cost, before it is sent (`BO_0279_009`).
 *
 * **Free, and never a press.** A quote is the generator's own dry run: it
 * spends nothing and makes nothing, which is why it may be asked again every
 * time the reader turns a control. Only a sender answers one — an agent run
 * has no price to give — and an extension that cannot say answers nothing, so
 * the shell shows nothing rather than a guess.
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const body = (await event.request.json().catch(() => ({}))) as {
      sender?: unknown;
      documentId?: unknown;
      blockId?: unknown;
      options?: unknown;
    };
    const sender = typeof body.sender === "string" ? body.sender : "";
    if (sender === "" || senderExtension(sender) === null) {
      event.json(200, { ok: false });
      return;
    }
    const given = body.options;
    const options =
      given !== null && typeof given === "object" && !Array.isArray(given)
        ? Object.fromEntries(
            Object.entries(given as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined;
    const quoted = await quoteSender({
      workspaceId: event.params.id ?? "",
      sender,
      documentId: typeof body.documentId === "string" ? body.documentId : "",
      blockId: typeof body.blockId === "string" ? body.blockId : "",
      ...(options === undefined ? {} : { options }),
    });
    event.json(200, quoted);
  });
