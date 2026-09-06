import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readWorkspace, saveWorkspace } from "~/server/workspaces";

export const onGet: RequestHandler = (event) =>
  api(event, async () =>
    event.json(200, await readWorkspace(event.params.id ?? "")),
  );

export const onPut: RequestHandler = (event) =>
  api(event, async () =>
    event.json(
      200,
      await saveWorkspace(event.params.id ?? "", await event.request.json()),
    ),
  );
