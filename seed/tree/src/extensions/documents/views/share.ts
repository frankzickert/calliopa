import { $ } from "@builder.io/qwik";

import type { ShareReceiver } from "~/contract";

import { placeShared, SHARED_EVENT, sharedTitle, shareables, type SharedHere } from "./shared";

/**
 * `documents`' share receiver (`calliopa-bootstrap`'s BO_0319_050): what is
 * shared into the app goes into the document the reader has open, below the
 * block they are in — its editor claims it — and, with no document open,
 * into a new document titled from what was shared, which the shell then
 * opens. A document open in a view that does not claim it takes it at its
 * end.
 */
export const receiveShared: ShareReceiver = $(async (items, at) => {
  const shared = shareables(items);
  if (shared.length === 0) return { taken: true };
  if (at.kind === "documents:document" && at.itemId !== null) {
    const detail: SharedHere = { documentId: at.itemId, items, taken: false };
    document.dispatchEvent(new CustomEvent(SHARED_EVENT, { detail }));
    if (!detail.taken) await placeShared(at.itemId, shared, null);
    return { taken: true };
  }
  const title = sharedTitle(shared);
  const created = await fetch("/api/x/documents/d", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const outcome = (await created.json().catch(() => ({}))) as { outcome?: string; result?: { documentId?: string } };
  const documentId = outcome.result?.documentId;
  if (outcome.outcome !== "success" || documentId === undefined) return { taken: false };
  await placeShared(documentId, shared, null);
  return { taken: true, open: { kind: "documents:document", itemId: documentId, title } };
});
