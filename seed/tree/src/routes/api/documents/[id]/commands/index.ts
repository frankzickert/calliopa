import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { handleDocumentCommand, unknownDocument } from "~/server/documents/api";
import { isRecordId } from "~/server/uuid";

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    const { status, body } = isRecordId(id)
      ? await handleDocumentCommand(event.request, db(), id)
      : unknownDocument(id);
    event.json(status, body);
  });
