import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readProcess } from "~/server/processes";

export const onGet: RequestHandler = (event) =>
  api(event, async () =>
    event.json(200, await readProcess(event.params.id ?? "")),
  );
