import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { createProcess, listProcesses } from "~/server/processes";

export const onGet: RequestHandler = (event) =>
  api(event, async () =>
    event.json(200, await listProcesses(event.params.id ?? "")),
  );

export const onPost: RequestHandler = (event) =>
  api(event, async () =>
    event.json(
      201,
      await createProcess(event.params.id ?? "", await event.request.json()),
    ),
  );
