import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { loginState, requestLogin } from "~/extensions/settings/server/adapters";

/** How the sign-in in flight is going, as the agent's broker reports it. */
export const onGet: RequestHandler = (event) =>
  api(event, async () => event.json(200, (await loginState()) ?? null));

/**
 * Asks the agent to run a runtime's own sign-in flow.
 *
 * The application asks and the agent runs it: the flows belong to the runtimes,
 * their credentials belong in the runtimes' own homes, and neither ever passes
 * through here.
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const body = (await event.request.json()) as { runtime?: unknown };
    const runtime = body.runtime;
    if (runtime !== "codex" && runtime !== "claude-code") {
      event.json(400, { error: `There is no ${String(runtime)} runtime.` });
      return;
    }
    await requestLogin(runtime);
    event.json(202, { runtime });
  });
