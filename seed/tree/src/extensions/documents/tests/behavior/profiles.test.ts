import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { PROFILE_RECORD } from "~/extensions/documents/lib/profile";
import {
  createDocument,
  deleteDocument,
  listDocuments,
  listProfiles,
  readDocument,
  readProfileSelection,
  setProfile,
} from "~/extensions/documents/server/documents";

/**
 * Profiles over the one graph (`BO_0298_017`, the server side): a profile
 * created with its record, listed among the profiles and left out of the
 * documents; a selection set and cleared as truth, read back; and the
 * refusals — a document that is no profile, a document that is not there.
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

  it("Given a selection set, Then it reads back as truth, and cleared it reads as none", async () => {
    expect(ok<{ profile: unknown; gone: unknown }>(await readProfileSelection(documentId))).toEqual({ profile: null, gone: null });
    const set = ok<{ profile: { id: string; title: string } | null }>(await setProfile({ documentId, profile: profileId }));
    expect(set.profile).toEqual({ id: profileId, title: "Blog post" });
    expect(ok<{ profile: { id: string } | null }>(await readProfileSelection(documentId)).profile?.id).toBe(profileId);
    // The selection is the document's, not a candidate of anyone's.
    const document = ok<{ revisionId: string }>(await readDocument(documentId));
    expect(document.revisionId.startsWith("rev:")).toBe(true);
    await settle();
    expect(ok<{ profile: unknown }>(await setProfile({ documentId, profile: null })).profile).toBeNull();
    expect(ok<{ profile: unknown; gone: unknown }>(await readProfileSelection(documentId))).toEqual({ profile: null, gone: null });
  });

  it("Given a document that is no profile, or none at all, Then the selection is refused in words", async () => {
    await settle();
    const notOne = await setProfile({ documentId, profile: documentId });
    expect(notOne.outcome).toBe("validationFailure");
    expect(JSON.stringify(notOne)).toContain("is not a profile");
    const missing = await setProfile({ documentId, profile: "00000000-0000-4000-8000-000000000000" });
    expect(missing.outcome).toBe("validationFailure");
    const nowhere = await setProfile({ documentId: "00000000-0000-4000-8000-000000000000", profile: null });
    expect(nowhere.outcome).toBe("noResult");
  });
});
