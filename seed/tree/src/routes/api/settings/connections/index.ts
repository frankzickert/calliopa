import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { listConnections } from "~/extensions/settings/server/connections";
import { db } from "~/server/db";

export const onGet: RequestHandler = (event) =>
  api(event, async () => event.json(200, await listConnections(db())));
