import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { writeRecordBinding } from "~/server/publishing/api";

export const onPut: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await writeRecordBinding(event.request, db(), {
      recordId: event.params["id"] as string,
      recordKind: "episode",
    });
    event.json(status, body);
  });
