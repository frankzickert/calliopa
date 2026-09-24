import { serverContributions as declare, type ApiRoute } from "~/contract";
import { jsonInit } from "~/server/kernel/client";

import { kernelJSON, listRuntimes } from "./server/kernel";

/**
 * The routes (`BO_0289_019`): each one the kernel's code surface with the
 * person's session forwarded, so the browser's calls carry no bearer and the
 * kernel's own gate — the owner alone for making, starting, stopping and
 * removing a runtime — is the one that decides. A person's execute goes to
 * the kernel directly from the browser, since it streams.
 */
const body = async (event: Parameters<ApiRoute["handle"]>[0]): Promise<Record<string, unknown>> =>
  ((await event.request.json().catch(() => ({}))) as Record<string, unknown>);

const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "runtimes",
    handle: async (event) => event.json(200, await listRuntimes()),
  },
  {
    method: "POST",
    path: "runtimes",
    handle: async (event) => event.json(202, await kernelJSON("/__kernel/code/runtimes", jsonInit("POST", await body(event)))),
  },
  {
    method: "POST",
    path: "runtimes/[id]/start",
    handle: async (event, params) =>
      event.json(200, await kernelJSON(`/__kernel/code/runtimes/${encodeURIComponent(params["id"] ?? "")}/start`, jsonInit("POST"))),
  },
  {
    method: "POST",
    path: "runtimes/[id]/stop",
    handle: async (event, params) =>
      event.json(200, await kernelJSON(`/__kernel/code/runtimes/${encodeURIComponent(params["id"] ?? "")}/stop`, jsonInit("POST"))),
  },
  {
    method: "DELETE",
    path: "runtimes/[id]",
    handle: async (event, params) =>
      event.json(200, await kernelJSON(`/__kernel/code/runtimes/${encodeURIComponent(params["id"] ?? "")}?closeSessions=1`, { method: "DELETE" })),
  },
  {
    method: "GET",
    path: "connection",
    handle: async (event) =>
      event.json(
        200,
        await kernelJSON(`/__kernel/code/connection?artifact=${encodeURIComponent(event.url.searchParams.get("artifact") ?? "")}`, { method: "GET" }),
      ),
  },
  {
    method: "PUT",
    path: "connection",
    handle: async (event) => event.json(200, await kernelJSON("/__kernel/code/connection", jsonInit("PUT", await body(event)))),
  },
  {
    method: "POST",
    path: "interrupt",
    handle: async (event) => event.json(200, await kernelJSON("/__kernel/code/interrupt", jsonInit("POST", await body(event)))),
  },
  {
    method: "POST",
    path: "restart",
    handle: async (event) => event.json(200, await kernelJSON("/__kernel/code/restart", jsonInit("POST", await body(event)))),
  },
  {
    method: "GET",
    path: "executions",
    handle: async (event) =>
      event.json(
        200,
        await kernelJSON(`/__kernel/code/executions?artifact=${encodeURIComponent(event.url.searchParams.get("artifact") ?? "")}`, { method: "GET" }),
      ),
  },
];

export const contributions = declare({
  routes,
  readers: {
    runtimes: listRuntimes,
  },
});
