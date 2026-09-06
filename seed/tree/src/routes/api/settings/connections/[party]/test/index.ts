import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { proveConnection, secretsKey } from "~/extensions/settings/server/connections";
import { db } from "~/server/db";

export const onPost: RequestHandler = (event) =>
  api(event, async () =>
    event.json(
      200,
      await proveConnection(db(), secretsKey(), event.params.party ?? ""),
    ),
  );
