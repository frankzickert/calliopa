import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { createWorkspace } from "~/server/workspaces";

export const onPost: RequestHandler = (event) =>
  api(event, async () => event.json(201, await createWorkspace()));
