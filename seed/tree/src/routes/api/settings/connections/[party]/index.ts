import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import {
  clearConnectionSecret,
  secretsKey,
  writeConnectionSecret,
} from "~/extensions/settings/server/connections";
import { db } from "~/server/db";

export const onPut: RequestHandler = (event) =>
  api(event, async () =>
    event.json(
      200,
      await writeConnectionSecret(
        db(),
        secretsKey(),
        event.params.party ?? "",
        await event.request.json(),
      ),
    ),
  );

export const onDelete: RequestHandler = (event) =>
  api(event, async () =>
    event.json(
      200,
      await clearConnectionSecret(db(), event.params.party ?? ""),
    ),
  );
