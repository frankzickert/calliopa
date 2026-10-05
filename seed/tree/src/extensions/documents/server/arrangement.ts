import { call, jsonInit } from "~/server/kernel/client";
import type { GraphOutcome } from "~/server/outcome";
import { NO_ARRANGEMENT, readArrangementBody, type Arrangement } from "../lib/arrangement";

/**
 * What Hermes arranged on a document for the signed-in person, read from the
 * kernel, which keeps it as the person's own state
 * (`/__kernel/arrangement?artifact=<document>`, `calliopa-bootstrap`'s
 * `BO_0350_054`). A kernel that keeps none answers none. BO_0350_005
 */
export async function readArrangement(documentId: string): Promise<GraphOutcome<Arrangement>> {
  const response = await call(`/__kernel/arrangement?artifact=${encodeURIComponent(documentId)}`, { method: "GET" });
  if (response.status === 404 || response.status === 401) return { outcome: "success", result: NO_ARRANGEMENT };
  if (!response.ok) return { outcome: "storageError", detail: `The kernel answered ${response.status} for the arrangement.` };
  return { outcome: "success", result: readArrangementBody(await response.json()) };
}

/**
 * Tells the kernel the signed-in person renamed a document, so Hermes reads
 * the new title as what the work is (`/__kernel/acts`, `calliopa-bootstrap`'s
 * `BO_0350_065`). It never fails the rename: an act the kernel did not take
 * is one Hermes does not see. BO_0350_065
 */
export async function recordTitle(documentId: string, title: string): Promise<void> {
  try {
    await call("/__kernel/acts", jsonInit("POST", { kind: "title", artifact: documentId, words: title }));
  } catch {
    // The rename stands either way.
  }
}
