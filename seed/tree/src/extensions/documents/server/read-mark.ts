import { call, jsonInit } from "~/server/kernel/client";
import type { GraphOutcome } from "~/server/outcome";

/**
 * The reader's mark on a document (`BO_0246_009`): the data revision at
 * which this person last had the document open with its derived blocks in
 * view, kept by the kernel under the person's own account
 * (`/__kernel/state/people/me/read/<document>`, `ui-kernel.md`
 * `BO_0246_001`). The cookie travels as on every kernel call, so the mark is
 * the signed-in person's and nobody else's.
 */

export interface ReadMark {
  readonly documentId: string;
  /** The data revision last read, or null when this person never marked it. */
  readonly dataRevision: number | null;
}

const path = (documentId: string): string => `/__kernel/state/people/me/read/${encodeURIComponent(documentId)}`;

export async function readMark(documentId: string): Promise<GraphOutcome<ReadMark>> {
  const response = await call(path(documentId), { method: "GET" });
  if (response.status === 404) return { outcome: "success", result: { documentId, dataRevision: null } };
  if (!response.ok) return { outcome: "storageError", detail: `The kernel answered ${response.status} for the read mark.` };
  const body = (await response.json()) as { dataRevision?: unknown };
  return {
    outcome: "success",
    result: { documentId, dataRevision: typeof body.dataRevision === "number" ? body.dataRevision : null },
  };
}

export async function writeMark(documentId: string, dataRevision: number): Promise<GraphOutcome<ReadMark>> {
  if (!Number.isInteger(dataRevision) || dataRevision < 0) {
    return { outcome: "validationFailure", failures: [{ operation: null, rule: "readMark", detail: "A read mark is a data revision." }] };
  }
  const response = await call(path(documentId), jsonInit("PUT", { dataRevision }));
  if (!response.ok) return { outcome: "storageError", detail: `The kernel answered ${response.status} for the read mark.` };
  return { outcome: "success", result: { documentId, dataRevision } };
}
