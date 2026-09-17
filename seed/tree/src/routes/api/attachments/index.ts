import type { RequestHandler } from "@builder.io/qwik-city";
import { MAX_ATTACHMENT_BYTES } from "~/lib/command-target";
import { api } from "~/server/api";
import { uploadAttachment } from "~/server/agent/attachments";

/**
 * Attaches a file to the next command: the body is the file, its name in
 * `X-Calliopa-Filename`, percent-encoded. The kernel stores it and extracts
 * its text; this answers the kernel's descriptor, or its refusal in its own
 * words. Nothing is written to the graph until the command is sent.
 * BO_0229_008
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const encoded = event.request.headers.get("x-calliopa-filename") ?? "";
    let filename = "";
    try {
      filename = decodeURIComponent(encoded).trim();
    } catch {
      event.json(400, { error: "The file's name is not percent-encoded." });
      return;
    }
    if (filename === "") {
      event.json(400, { error: "The file's name belongs in X-Calliopa-Filename." });
      return;
    }
    const declared = Number(event.request.headers.get("content-length") ?? "0");
    if (declared > MAX_ATTACHMENT_BYTES) {
      event.json(413, { error: `${filename} is larger than 10 MB, the most a command can carry per file.` });
      return;
    }
    const body = await event.request.arrayBuffer();
    const uploaded = await uploadAttachment(body, filename, event.request.headers.get("content-type") ?? "");
    if (!uploaded.ok) {
      event.json(uploaded.status, { error: uploaded.error });
      return;
    }
    event.json(200, uploaded.descriptor);
  });
