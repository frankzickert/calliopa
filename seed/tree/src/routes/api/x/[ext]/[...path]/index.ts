import type { RequestHandler } from "@builder.io/qwik-city";
import { dispatch } from "~/server/registry";

/**
 * The one catch-all every extension's API is served through: `/api/x/<ext>/…`
 * routes by extension id into the handler table the extension's server half
 * contributes. The host's own endpoints — workspaces, processes, runs, the
 * library readers and `/health` — are not contributions and keep their
 * routes. BO_0202_006
 */
export const onRequest: RequestHandler = (event) =>
  dispatch(event, event.params["ext"] ?? "", event.params["path"] ?? "");
