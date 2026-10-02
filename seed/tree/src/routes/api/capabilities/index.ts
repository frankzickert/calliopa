import type { RequestHandler } from "@builder.io/qwik-city";

import { api } from "~/server/api";
import { readCapabilities } from "~/server/capabilities";

/** Every remote capability's state where the shell runs. BO_0319_043 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    event.json(200, { capabilities: await readCapabilities() });
  });
