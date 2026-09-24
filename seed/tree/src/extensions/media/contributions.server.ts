import { serverContributions as declare, type ApiRoute } from "~/contract";
import { HttpError } from "~/server/http-error";

import { remakeGeneration } from "./server/make";
import { mediaSenders, quoteToModel, sendToModel } from "./server/senders";
import { sourceOf } from "./server/source";
import { captureAxes, offeredRoster, readOffered, writeOffered } from "./server/offered";
import { TOOLS, ToolRefusal, type ToolCall } from "./server/tools";
import { proposeGeneration } from "./server/propose";
import {
  SERVICES,
  handBackRedirect,
  chooseWorkspace,
  requestSignIn,
  roster,
  signInState,
  type GeneratorService,
} from "./server/media";

const isService = (value: unknown): value is GeneratorService =>
  typeof value === "string" && (SERVICES as readonly string[]).includes(value);

const routes: readonly ApiRoute[] = [
  {
    // What the instance can make, and which services are signed in. Read
    // through the kernel, which holds the service's bearer.
    method: "GET",
    path: "services",
    // `?offered=1` is what the dropdown asks for: the owner's own set. Settings
    // asks for the whole roster, because that is what it offers a choice from.
    // BO_0273_029
    handle: async (event) =>
      event.json(200, {
        services: event.url.searchParams.get("offered") === "1" ? await offeredRoster() : await roster(),
      }),
  },
  {
    // Proposes a picture that is not made yet: a pending block staged into a
    // group of its own, after the block whose words are the prompt. Free — a
    // rejected proposal has cost nothing — and a person's, like the quote.
    // BO_0273_017
    method: "POST",
    path: "propose",
    handle: async (event) => {
      const body = (await event.request.json()) as Record<string, unknown>;
      const text = (name: string) => (typeof body[name] === "string" ? (body[name] as string) : "");
      const proposed = await proposeGeneration({
        documentId: text("documentId"),
        afterBlockId: text("afterBlockId"),
        service: text("service"),
        model: text("model"),
        kind: text("kind"),
        prompt: text("prompt"),
      });
      if (!proposed.ok) {
        event.json(400, { error: proposed.refusal });
        return;
      }
      event.json(202, { group: proposed.group, blockId: proposed.blockId });
    },
  },
  {
    // Which models the dropdown offers. Read by anyone signed in; written by
    // the owner alone, which the kernel enforces on the record. BO_0273_029
    method: "GET",
    path: "offered",
    handle: async (event) => event.json(200, await readOffered()),
  },
  {
    method: "PUT",
    path: "offered",
    handle: async (event) => {
      const body = (await event.request.json()) as Record<string, unknown>;
      const list = (name: string): string[] =>
        Array.isArray(body[name]) ? (body[name] as unknown[]).filter((one): one is string => typeof one === "string") : [];
      const map = (name: string): Record<string, unknown> =>
        body[name] !== null && typeof body[name] === "object" && !Array.isArray(body[name])
          ? (body[name] as Record<string, unknown>)
          : {};
      // The names and the icons travel with the set. They were written by the
      // section and dropped here, so an owner who renamed a model or gave it an
      // icon lost both on the next read. BO_0273_037
      const held = await readOffered();
      event.json(200, await writeOffered({
        models: list("models"),
        named: list("named"),
        names: map("names"),
        icons: map("icons"),
        axes: held.axes ?? {},
      }));
    },
  },
  {
    // What made a picture. Read only when the reader turns to the block, so a
    // document full of pictures costs nothing to read. BO_0273_019
    method: "GET",
    path: "source",
    handle: async (event) =>
      event.json(200, await sourceOf(
        event.url.searchParams.get("documentId") ?? "",
        event.url.searchParams.get("blockId") ?? "",
      )),
  },
  {
    // Makes the same picture again, from what made it the first time: a fresh
    // press and a fresh cost. BO_0273_019
    method: "POST",
    path: "remake",
    handle: async (event) => {
      const body = (await event.request.json()) as Record<string, unknown>;
      const text = (name: string) => (typeof body[name] === "string" ? (body[name] as string) : "");
      const making = await remakeGeneration({
        workspaceId: text("workspaceId"),
        documentId: text("documentId"),
        blockId: text("blockId"),
      });
      if (!making.ok) {
        event.json(400, { error: making.refusal });
        return;
      }
      event.json(202, { processId: making.processId });
    },
  },
  {
    // Asks the service to run a vendor's own sign-in flow. The application
    // asks and the service runs it: the flows belong to the vendors, their
    // credentials belong in the vendors' own homes, and neither ever passes
    // through here.
    method: "POST",
    path: "sign-in",
    handle: async (event) => {
      const body = (await event.request.json()) as { service?: unknown };
      if (!isService(body.service)) {
        event.json(400, { error: `There is no ${String(body.service)} service.` });
        return;
      }
      const id = await requestSignIn(body.service);
      event.json(202, { service: body.service, id });
    },
  },
  {
    // Asks the vendor what each offered model takes and keeps it. Free, and
    // never on the path of a press: the section runs it when it opens and
    // after a save, and a row's *Ask again* runs it for one model.
    // BO_0279_011 BO_0279_015
    method: "POST",
    path: "offered/axes",
    handle: async (event) => {
      const body = (await event.request.json().catch(() => ({}))) as { model?: unknown };
      const only = typeof body.model === "string" && body.model !== "" ? body.model : undefined;
      event.json(200, await captureAxes(only));
    },
  },
  {
    // Selects the workspace a service submits into, which is only choosable
    // once signed in. Free: it spends nothing and makes nothing. BO_0273_042
    method: "POST",
    path: "workspace",
    handle: async (event) => {
      const body = (await event.request.json()) as { service?: unknown; workspace?: unknown };
      if (!isService(body.service)) {
        event.json(400, { error: `There is no ${String(body.service)} service.` });
        return;
      }
      const workspace = typeof body.workspace === "string" ? body.workspace.trim() : "";
      if (workspace === "") {
        event.json(400, { error: "A workspace is needed." });
        return;
      }
      const taken = await chooseWorkspace(body.service, workspace);
      if (!taken.ok) {
        event.json(400, { error: taken.refusal });
        return;
      }
      event.json(200, { service: body.service, workspace });
    },
  },
  {
    method: "GET",
    path: "sign-in",
    handle: async (event) =>
      event.json(200, (await signInState(event.url.searchParams.get("id") ?? undefined)) ?? null),
  },
  {
    // The redirect a Higgsfield login waits for, which the owner's browser
    // cannot deliver: its listener is inside the service's container. It is
    // written where the broker reads it and never answered back.
    method: "POST",
    path: "sign-in/redirect",
    handle: async (event) => {
      const body = (await event.request.json()) as {
        service?: unknown;
        id?: unknown;
        code?: unknown;
        state?: unknown;
      };
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const state = typeof body.state === "string" ? body.state.trim() : "";
      if (!isService(body.service) || id === "" || code === "" || state === "") {
        event.json(400, { error: "The flow, the code and the state are all needed." });
        return;
      }
      await handBackRedirect(body.service, id, code, state);
      event.json(202, {});
    },
  },
];

/**
 * What the kernel calls: the tools a run reaches. Answered only with the
 * secret the kernel generated at its start, which the proxy strips from every
 * browser request — so this is the one door a run has, and nothing that spends
 * is behind it. BO_0273_018
 */
const kernelRoutes: readonly ApiRoute[] = [
  {
    method: "POST",
    path: "kernel/tools/[tool]",
    kernelCallback: true,
    handle: async (event, params) => {
      const tool = TOOLS[params["tool"] as keyof typeof TOOLS];
      if (tool === undefined) throw new HttpError(404, `media answers no tool ${params["tool"] ?? ""}`);
      const body = (await event.request.json()) as Record<string, unknown>;
      const asked: ToolCall = {
        input: (typeof body["input"] === "object" && body["input"] !== null ? body["input"] : {}) as Record<string, unknown>,
        run: (body["run"] ?? { id: "", group: "", pin: 0 }) as ToolCall["run"],
      };
      try {
        event.json(200, await tool(asked));
      } catch (error) {
        if (error instanceof ToolRefusal) throw new HttpError(422, error.message);
        throw error;
      }
    },
  },
];

export const contributions = declare({
  routes: [...routes, ...kernelRoutes],
  // The models, beside the agents. BO_0273_035
  senders: mediaSenders,
  send: sendToModel,
  // Free: the adapters' own dry run, asked as the reader turns a control
  // rather than as part of a press. BO_0279_013
  quote: quoteToModel,
  // No parties. A `credential: "status"` party is an *agent runtime* to the
  // settings extension: `withStatus` looks it up in what the agent reported
  // (`adapters.json`, which the hermes broker writes for codex and claude-code
  // alone), so a generator listed there reads "The agent has not reported on
  // this runtime" forever. The generators' sign-in is this extension's own
  // Generators section, which has the real state from the media service, and
  // one surface is the right number. BO_0273_032
});
