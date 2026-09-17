import type { RequestHandler } from "@builder.io/qwik-city";
import { attachmentForProcess, fetchAttachmentFile, fileHeaders } from "~/server/agent/attachments";

/**
 * Opens an attachment's file as a download: its stored media type, a
 * `Content-Disposition: attachment`, and `nosniff`, so a file never renders in
 * the shell's origin. BO_0229_011
 *
 * A file opens only through a run the person may see: `?process=` names the
 * process, whose run is read from the kernel as the person, and the file is
 * sent only when that run carried it. Anything else answers as unknown, so an
 * attachment of someone else's run is not disclosed. BO_0232_008
 */
export const onGet: RequestHandler = async (event) => {
  event.cacheControl({ noCache: true, public: false });
  const id = event.params.id ?? "";
  const attachment = await attachmentForProcess(event.url.searchParams.get("process") ?? "", id);
  if (attachment === null) {
    event.json(404, { error: `No attachment ${id} is known here.` });
    return;
  }
  const file = await fetchAttachmentFile(attachment.fileHash);
  if (!file.ok) {
    event.json(502, { error: `The file of ${attachment.filename} could not be read: CCGW answered ${file.status}.` });
    return;
  }
  // At most 10 MB, so it is sent whole rather than streamed.
  const bytes = new Uint8Array(await file.arrayBuffer());
  for (const [name, value] of Object.entries(fileHeaders(attachment))) event.headers.set(name, value);
  event.send(200, bytes);
};
