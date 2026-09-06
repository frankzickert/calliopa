import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import {
  handleDocumentCreate,
  handleDocumentList,
} from "~/server/documents/api";

export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleDocumentList(db());
    event.json(status, body);
  });

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleDocumentCreate(event.request, db());
    event.json(status === 200 ? 201 : status, body);
  });
