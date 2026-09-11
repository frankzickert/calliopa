import { serverContributions as declare, type ApiRoute } from "~/contract";
import { loginState, requestLogin, sendLoginCode } from "~/server/agent/adapters";
import { configureHermesModel } from "~/server/agent/bridge";
import { HttpError } from "~/server/http-error";
import { kernelAccounts } from "~/server/kernel/accounts";
import { kernelUpdate } from "~/server/kernel/update";
import { readSession } from "~/server/session";
import {
  clearConnectionSecret,
  listConnections,
  proveConnection,
  writeConnectionSecret,
} from "./server/connections";

/**
 * The server half of the settings extension: its handler table under
 * `/api/x/settings/`, and the parties Calliopa itself needs to run — the
 * agent, its two runtimes and its memory. A channel a destination needs is
 * the publishing extension's to contribute, not this one's. BO_0202_006
 * BO_0202_008
 */

/** A body's string field, or a refusal in words. */
const field = (body: Record<string, unknown>, name: string, required = true): string => {
  const value = body[name];
  if (typeof value === "string" && value.trim() !== "") return value;
  if (!required) return "";
  throw new HttpError(400, `${name} is needed.`);
};

const bodyOf = async (event: { request: Request }): Promise<Record<string, unknown>> => {
  const body = (await event.request.json()) as unknown;
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
};

/**
 * The people routes: every one a call to the kernel as the signed-in person,
 * refused by the core on its own terms and passed through with its code.
 * BO_0209_004
 */
const people: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "people/me",
    handle: async (event) => event.json(200, await readSession()),
  },
  {
    method: "GET",
    path: "people",
    handle: async (event) => event.json(200, await kernelAccounts.list()),
  },
  {
    method: "POST",
    path: "people",
    handle: async (event) => {
      const body = await bodyOf(event);
      event.json(
        201,
        await kernelAccounts.create({
          name: field(body, "name").trim(),
          class: field(body, "class"),
          password: field(body, "password"),
        }),
      );
    },
  },
  {
    method: "POST",
    path: "people/[name]/state",
    handle: async (event, params) =>
      event.json(200, await kernelAccounts.setState(params["name"] ?? "", field(await bodyOf(event), "state"))),
  },
  {
    method: "POST",
    path: "people/[name]/class",
    handle: async (event, params) =>
      event.json(200, await kernelAccounts.setClass(params["name"] ?? "", field(await bodyOf(event), "class"))),
  },
  {
    method: "POST",
    path: "people/[name]/password",
    handle: async (event, params) => {
      const body = await bodyOf(event);
      const current = field(body, "currentPassword", false);
      event.json(
        200,
        await kernelAccounts.setPassword(params["name"] ?? "", field(body, "password"), current === "" ? undefined : current),
      );
    },
  },
  {
    method: "GET",
    path: "people/licence",
    handle: async (event) => event.json(200, await kernelAccounts.licence()),
  },
];

/**
 * The update routes: every one a call to the kernel's update surface as the
 * signed-in person, refused with `forbidden` for anyone but the owner and
 * passed through with its code. BO_0223_014
 */
const update: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "update",
    handle: async (event) => event.json(200, await kernelUpdate.read()),
  },
  {
    method: "GET",
    path: "update/proposal",
    handle: async (event) => event.json(200, await kernelUpdate.proposal()),
  },
  {
    method: "POST",
    path: "update",
    handle: async (event) => event.json(202, await kernelUpdate.start(field(await bodyOf(event), "version"))),
  },
  {
    method: "POST",
    path: "update/accept",
    // The kernel accepts the update it recorded; nothing in the request
    // names a proposal. BO_0241_005
    handle: async (event) => event.json(200, await kernelUpdate.accept()),
  },
  {
    method: "POST",
    path: "update/promote",
    handle: async (event) => event.json(202, await kernelUpdate.promote()),
  },
];

const routes: readonly ApiRoute[] = [
  ...people,
  ...update,
  {
    method: "GET",
    path: "connections",
    handle: async (event) => event.json(200, await listConnections()),
  },
  {
    method: "PUT",
    path: "connections/[party]",
    handle: async (event, params) =>
      event.json(200, await writeConnectionSecret(params["party"] ?? "", await event.request.json())),
  },
  {
    method: "DELETE",
    path: "connections/[party]",
    handle: async (event, params) => event.json(200, await clearConnectionSecret(params["party"] ?? "")),
  },
  {
    method: "POST",
    path: "connections/[party]/test",
    handle: async (event, params) => event.json(200, await proveConnection(params["party"] ?? "")),
  },
  {
    // What Hermes's own loop reasons with, set explicitly from the agent's
    // row; the kernel refuses the API-key model while none is configured,
    // and its words come back as they are. BO_0228_012
    method: "PUT",
    path: "agent/hermes-model",
    handle: async (event) => {
      const model = field(await bodyOf(event), "model");
      if (model !== "subscription" && model !== "provider") {
        throw new HttpError(400, "model must be subscription or provider.");
      }
      const reply = await configureHermesModel(model);
      if (!reply.ok) throw new HttpError(reply.status, reply.detail);
      event.json(200, { model: reply.value });
    },
  },
  {
    /** How the sign-in in flight is going, as the agent's broker reports it. */
    method: "GET",
    path: "agent/login",
    handle: async (event) => event.json(200, (await loginState()) ?? null),
  },
  {
    // Asks the agent to run a runtime's own sign-in flow. The application asks
    // and the agent runs it: the flows belong to the runtimes, their
    // credentials belong in the runtimes' own homes, and neither ever passes
    // through here.
    method: "POST",
    path: "agent/login",
    handle: async (event) => {
      const body = (await event.request.json()) as { runtime?: unknown };
      const runtime = body.runtime;
      if (runtime !== "codex" && runtime !== "claude-code") {
        event.json(400, { error: `There is no ${String(runtime)} runtime.` });
        return;
      }
      await requestLogin(runtime);
      event.json(202, { runtime });
    },
  },
  {
    // Hands the broker the code a flow asked for. It is written where the
    // broker reads it and is never answered back: it is a one-time code, and
    // a surface that could read it again would be a place it could be taken
    // from.
    method: "POST",
    path: "agent/code",
    handle: async (event) => {
      const body = (await event.request.json()) as { code?: unknown };
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (code === "") {
        event.json(400, { error: "A code is needed." });
        return;
      }
      await sendLoginCode(code);
      event.json(202, {});
    },
  },
];

export const contributions = declare({
  routes,
  parties: [
    {
      id: "honcho",
      kind: "service",
      credential: "apiKey",
      label: "Honcho",
      purpose: "OpenAI API key for the agent's memory",
      fields: [],
      // Listing models is the cheapest call that requires the key and changes nothing.
      probe: {
        authorization: { secretField: "apiKey" },
        test: { method: "GET", url: "https://api.openai.com/v1/models", expectStatus: 200 },
      },
    },
    {
      id: "hermes",
      kind: "service",
      credential: "status",
      label: "Hermes",
      purpose: "The agent Calliopa hands goals to",
      fields: [],
    },
    {
      id: "codex",
      kind: "service",
      credential: "status",
      label: "Codex",
      purpose: "Reasons for the agent, on your ChatGPT subscription",
      fields: [],
    },
    {
      id: "claude-code",
      kind: "service",
      credential: "status",
      label: "Claude Code",
      purpose: "Writes code for the agent, on your Claude subscription",
      fields: [],
    },
  ],
});
