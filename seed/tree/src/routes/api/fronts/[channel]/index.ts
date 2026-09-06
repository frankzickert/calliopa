import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import {
  readFrontDetail,
  writeFrontValues,
} from "~/server/publishing/front-api";

export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await readFrontDetail(
      db(),
      event.params["channel"] as string,
    );
    event.json(status, body);
  });

export const onPut: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await writeFrontValues(
      event.request,
      db(),
      event.params["channel"] as string,
    );
    event.json(status, body);
  });
