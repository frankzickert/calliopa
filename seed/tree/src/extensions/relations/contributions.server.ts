import { serverContributions as declare, type ApiRoute } from "~/contract";

import { handleRelationCommand } from "./server/api";

/**
 * The server half of `relations`: its own command route, under
 * `/api/x/relations/`. The extension owns the relation vocabulary
 * (`BO_0288_015`), so it owns the writes of it; `documents`' single switch
 * keeps the block operations. Only server code imports this module.
 */

const routes: readonly ApiRoute[] = [
  {
    method: "POST",
    path: "commands",
    handle: async (event) => {
      const { status, body } = await handleRelationCommand(event.request);
      event.json(status, body);
    },
  },
];

export const contributions = declare({ routes });
