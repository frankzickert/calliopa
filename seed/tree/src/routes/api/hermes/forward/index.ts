import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { call } from "~/server/kernel/client";

/**
 * The documents Hermes puts forward for the signed-in person, read from their
 * arrangement in the kernel (`calliopa-bootstrap`'s `BO_0350_059`):
 * `{forward: [document…]}`. BO_0350_024
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const response = await call("/__kernel/arrangement?artifact=", { method: "GET" });
    const body = (await response.json().catch(() => ({}))) as { forward?: unknown };
    const forward = Array.isArray(body.forward) ? body.forward.filter((entry): entry is string => typeof entry === "string") : [];
    event.json(200, { forward: response.ok ? forward : [] });
  });
