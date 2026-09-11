import type { RequestHandler } from "@builder.io/qwik-city";
import { isAgentId } from "~/lib/connections";
import { api } from "~/server/api";
import { chooseAgent } from "~/server/agent/adapters";

/**
 * Remembers the composer's choice for the whole instance. Only the three
 * agents are taken; anything else is refused in words and nothing is
 * written. BO_0228_009
 */
export const onPut: RequestHandler = (event) =>
  api(event, async () => {
    let body: { agent?: unknown } | null = null;
    try {
      body = (await event.request.json()) as { agent?: unknown } | null;
    } catch {
      body = null;
    }
    const agent = body?.agent;
    if (!isAgentId(agent)) {
      event.json(400, { error: "agent must be codex, claude-code or hermes" });
      return;
    }
    await chooseAgent(agent);
    event.json(200, { chosen: agent });
  });
