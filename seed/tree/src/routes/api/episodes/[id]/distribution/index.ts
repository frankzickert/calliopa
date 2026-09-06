import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { readDistribution } from "~/server/publishing/api";

export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await readDistribution(
      db(),
      event.params["id"] as string,
    );
    event.json(status, body);
  });
