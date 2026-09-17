import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { configureRefinement, readRefinement } from "~/server/agent/bridge";
import { parseRefinement } from "~/lib/refinement";

/**
 * Whether the kernel refines on its own and after how long a quiet, read
 * and set through the kernel's own route as the person whose browser asked;
 * the kernel refuses a change from anyone but the owner, and its words come
 * back as they are. BO_0245_011
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const reply = await readRefinement();
    if (!reply.ok) {
      event.json(reply.status, { error: reply.detail });
      return;
    }
    event.json(200, reply.value);
  });

export const onPut: RequestHandler = (event) =>
  api(event, async () => {
    let body: unknown = null;
    try {
      body = await event.request.json();
    } catch {
      body = null;
    }
    const settings = parseRefinement(body);
    if (settings === null) {
      event.json(400, { error: "refinement takes enabled (true or false) and settleSeconds (a whole number of seconds, 0 or more)." });
      return;
    }
    const reply = await configureRefinement(settings);
    if (!reply.ok) {
      event.json(reply.status, { error: reply.detail });
      return;
    }
    event.json(200, reply.value);
  });
