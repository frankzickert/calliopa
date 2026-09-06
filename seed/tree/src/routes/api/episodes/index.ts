import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import {
  handleEpisodeCreate,
  handleEpisodeList,
} from "~/server/production/api";

export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleEpisodeList(db());
    event.json(status, body);
  });

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleEpisodeCreate(event.request, db());
    event.json(status === 200 ? 201 : status, body);
  });
