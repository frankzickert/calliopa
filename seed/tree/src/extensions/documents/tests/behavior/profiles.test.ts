import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { write } from "~/server/ccgw/client";
import { readGraphEnv } from "~/server/ccgw/env";
import { nodeRef } from "~/server/ccgw/nodes";
import { PROFILE_RECORD } from "~/extensions/documents/lib/profile";
import {
  clearProfileSlotsStatement,
  createDocument,
  deleteDocument,
  listDocuments,
  listProfiles,
  profileSummary,
  readDocument,
} from "~/extensions/documents/server/documents";

/**
 * Profiles over the one graph (`BO_0298_017`, the server side): a profile
 * created with its record, listed among the profiles and left out of the
 * documents; a document told apart as a profile or not; and the `profile`
 * slot a document kept before the chip chose per command, cleared by one
 * script and found nowhere after (`calliopa-bootstrap`'s `BO_0311_020`).
 * Runs under the kernel harness like `documents.test.ts`.
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 300));

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success") {
    throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  }
  return outcome["result"] as T;
};

describe.skipIf(!configured)("profiles over CCGW", () => {
  let profileId = "";
  let documentId = "";

  beforeAll(async () => {
    profileId = ok<{ documentId: string }>(await createDocument({ title: "Blog post", record: PROFILE_RECORD })).documentId;
    documentId = ok<{ documentId: string }>(await createDocument({ title: "Guided" })).documentId;
  });

  afterAll(async () => {
    for (const id of [documentId, profileId]) {
      const document = await readDocument(id);
      if (document.outcome === "success") {
        await settle();
        await deleteDocument({ documentId: id, baseRevisionId: document.result.revisionId });
      }
    }
  });

  it("Given a profile created, Then it lists among the profiles and not among the documents", async () => {
    const profiles = ok<readonly { id: string; title: string }[]>(await listProfiles());
    expect(profiles.some((entry) => entry.id === profileId && entry.title === "Blog post")).toBe(true);
    const documents = ok<readonly { documentId: string }[]>(await listDocuments());
    expect(documents.some((entry) => entry.documentId === profileId)).toBe(false);
    expect(documents.some((entry) => entry.documentId === documentId)).toBe(true);
  });

  it("Given a profile and a document, Then each is told apart as a profile or not", async () => {
    expect(ok<unknown>(await profileSummary(profileId))).toEqual({ id: profileId, title: "Blog post" });
    expect(ok<unknown>(await profileSummary(documentId))).toBeNull();
    expect(ok<unknown>(await profileSummary("00000000-0000-4000-8000-000000000000"))).toBeNull();
  });

  it("Given a document still carrying a profile slot, Then one script clears it and none is left", async () => {
    await settle();
    expect((await write("SET d.profile = $p", { dNodeId: nodeRef(documentId), p: profileId }, "a slot kept from before BO_0311")).outcome).toBe("success");
    const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await clearProfileSlotsStatement());
    const alias = Object.entries(statement.parameters).find(([, value]) => value === nodeRef(documentId))?.[0];
    expect(alias).toBeDefined();
    expect(statement.statement).toContain(`${String(alias).replace(/NodeId$/u, "")}.profile = null`);
    await settle();
    expect((await write(statement.statement, statement.parameters, "clear the profile slots")).outcome).toBe("success");
    const after = ok<{ parameters: Record<string, unknown> }>(await clearProfileSlotsStatement());
    expect(Object.values(after.parameters)).not.toContain(nodeRef(documentId));
  });
});
