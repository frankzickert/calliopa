import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { call } from "~/server/kernel/client";

/** Erases one thing Hermes learned of the signed-in person. BO_0350_023 */
export const onDelete: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    const response = await call(`/__kernel/hermes/learned/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.status === 204) {
      event.send(204, "");
      return;
    }
    event.json(response.status, await response.json().catch(() => ({ error: `The kernel answered ${response.status}.` })));
  });
