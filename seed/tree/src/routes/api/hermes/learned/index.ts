import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { call } from "~/server/kernel/client";

/**
 * What Hermes learned of the signed-in person, as the kernel answers it from
 * Hermes's memory (`calliopa-bootstrap`'s `BO_0350_062`): `{memory, learned:
 * [{id, words, at}]}`, the person's own and nobody else's. BO_0350_023
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const response = await call("/__kernel/hermes/learned", { method: "GET" });
    event.json(response.status, await response.json().catch(() => ({ memory: "off", learned: [] })));
  });
