import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readSection } from "~/server/registry";

/**
 * One library section re-read: the same contributed reader the page loaders
 * call, so the drawer refreshes after a create or a rename without the
 * section naming a route of its own. BO_0202_005
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const outcome = await readSection(event.params["ext"] ?? "", event.params["section"] ?? "");
    if (outcome === undefined) {
      event.json(404, { error: "no such library section" });
      return;
    }
    event.json(200, outcome);
  });
