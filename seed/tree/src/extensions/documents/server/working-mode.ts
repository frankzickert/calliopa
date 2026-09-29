import { call, jsonInit } from "~/server/kernel/client";
import type { GraphOutcome } from "~/server/outcome";
import { FIRST_MODE, readWorkingMode, type WorkingMode } from "../lib/working-mode";

/**
 * The working mode the signed-in person chose for a document (`BO_0306_011`),
 * kept by the kernel under the person's own account beside the read mark
 * (`/__kernel/state/people/me/mode/<document>`, `ui-kernel.md`
 * `BO_0306_005`). A document never set is the person's first mode,
 * explore + create.
 */

const path = (documentId: string): string => `/__kernel/state/people/me/mode/${encodeURIComponent(documentId)}`;

export async function readMode(documentId: string): Promise<GraphOutcome<WorkingMode>> {
  const response = await call(path(documentId), { method: "GET" });
  if (response.status === 404) return { outcome: "success", result: FIRST_MODE };
  if (!response.ok) return { outcome: "storageError", detail: `The kernel answered ${response.status} for the working mode.` };
  return { outcome: "success", result: readWorkingMode(await response.json()) ?? FIRST_MODE };
}

export async function writeMode(documentId: string, value: unknown): Promise<GraphOutcome<WorkingMode>> {
  const mode = readWorkingMode(value);
  if (mode === null) {
    return {
      outcome: "validationFailure",
      failures: [{ operation: null, rule: "workingMode", detail: "A working mode is explore or consolidate, and understand or create." }],
    };
  }
  const response = await call(path(documentId), jsonInit("PUT", mode));
  if (!response.ok) return { outcome: "storageError", detail: `The kernel answered ${response.status} for the working mode.` };
  return { outcome: "success", result: mode };
}
