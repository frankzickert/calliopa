import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { handleGraphStage } from "~/server/graph/api";
import { calliopaGraphSchema } from "~/server/graph/schema";

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleGraphStage(
      event.request,
      db(),
      calliopaGraphSchema,
    );
    event.json(status, body);
  });
