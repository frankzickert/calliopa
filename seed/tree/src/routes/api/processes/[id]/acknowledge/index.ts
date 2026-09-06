import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { acknowledgeProcess } from "~/server/processes";

export const onPost: RequestHandler = (event) =>
  api(event, async () =>
    event.json(200, await acknowledgeProcess(event.params.id ?? "")),
  );
