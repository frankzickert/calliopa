import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDocument,
  deleteDocument,
  insertBlock,
  readDocument,
} from "~/extensions/documents/server/documents";
import { readGraphEnv } from "~/server/ccgw/env";

import type { DocumentRolesView, DocumentRoleView } from "../../lib/roles";
import {
  createDocumentRole,
  listDocumentRoles,
  readDocumentRole,
  reviseDocumentRole,
  rolesOf,
  setBlockRole,
  setDocumentRole,
} from "../../server/roles";
import { readDocumentRoles, ToolRefusal } from "../../server/tools";

/**
 * Document and block roles over the one graph (`BO_0299_018`, the server
 * side): a document role created with its block roles and reordered; a
 * document and a block roled as truth with no proposal, read back in reading
 * order; the document's role changed keeping the block's role as not
 * offered; a block role retired keeping the assignment as retired; the
 * tool's answer; and each refusal by name. Runs under the kernel harness
 * like `documents.test.ts`.
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 350));

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success")
    throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome["result"] as T;
};

const NOWHERE = "00000000-0000-4000-8000-000000000000";

describe.skipIf(!configured)("document and block roles over CCGW", () => {
  let documentId = "";
  let first = "";
  let second = "";
  let story: DocumentRoleView;
  let essay: DocumentRoleView;
  let hook = "";
  let closing = "";
  let thesis = "";

  beforeAll(async () => {
    const created = ok<{ documentId: string; blockId: string }>(
      await createDocument({ title: "A roled document" }),
    );
    documentId = created.documentId;
    first = created.blockId;
    await settle();
    second = ok<{ blockId: string }>(
      await insertBlock({
        documentId,
        block: { kind: "text" },
        placement: { after: first },
      }),
    ).blockId;
    story = ok<DocumentRoleView>(
      await createDocumentRole({
        name: "Story",
        description: "A story with a hook and a closing",
      }),
    );
    story = ok<DocumentRoleView>(
      await reviseDocumentRole(story.id, {
        command: "addBlockRole",
        name: "Hook",
        description: "Opens the story",
      }),
    );
    story = ok<DocumentRoleView>(
      await reviseDocumentRole(story.id, {
        command: "addBlockRole",
        name: "Closing",
      }),
    );
    hook = story.blockRoles.find((role) => role.name === "Hook")!.id;
    closing = story.blockRoles.find((role) => role.name === "Closing")!.id;
    essay = ok<DocumentRoleView>(await createDocumentRole({ name: "Essay" }));
    essay = ok<DocumentRoleView>(
      await reviseDocumentRole(essay.id, {
        command: "addBlockRole",
        name: "Thesis",
      }),
    );
    thesis = essay.blockRoles[0]!.id;
  });

  afterAll(async () => {
    const document = await readDocument(documentId);
    if (document.outcome === "success") {
      await settle();
      await deleteDocument({
        documentId,
        baseRevisionId: document.result.revisionId,
      });
    }
  });

  it("Given a document role with block roles, Then the catalogue lists it in the person's order, and a reorder moves them", async () => {
    const listed = ok<DocumentRoleView[]>(await listDocumentRoles());
    const found = listed.find((role) => role.id === story.id)!;
    expect(found.description).toBe("A story with a hook and a closing");
    expect(found.blockRoles.map((role) => role.name)).toEqual([
      "Hook",
      "Closing",
    ]);
    expect(found.blockRoles[0]!.description).toBe("Opens the story");
    const reordered = ok<DocumentRoleView>(
      await reviseDocumentRole(story.id, {
        command: "reorder",
        blockRoles: [closing, hook],
      }),
    );
    expect(reordered.blockRoles.map((role) => role.name)).toEqual([
      "Closing",
      "Hook",
    ]);
    await settle();
    ok<DocumentRoleView>(
      await reviseDocumentRole(story.id, {
        command: "reorder",
        blockRoles: [hook, closing],
      }),
    );
    await settle();
    const renamed = ok<DocumentRoleView>(
      await reviseDocumentRole(story.id, {
        command: "renameBlockRole",
        blockRole: hook,
        name: "The hook",
      }),
    );
    expect(renamed.blockRoles[0]!.name).toBe("The hook");
    await settle();
    ok<DocumentRoleView>(
      await reviseDocumentRole(story.id, {
        command: "renameBlockRole",
        blockRole: hook,
        name: "Hook",
      }),
    );
    expect(
      (
        await reviseDocumentRole(story.id, {
          command: "retireBlockRole",
          blockRole: NOWHERE,
        })
      ).outcome,
    ).toBe("validationFailure");
    expect((await readDocumentRole(NOWHERE)).outcome).toBe("validationFailure");
  });

  it("Given a document given a role and its first block a block role, Then both read back as truth in reading order", async () => {
    const none = ok<DocumentRolesView>(await rolesOf(documentId));
    expect(none.documentRole).toBeNull();
    expect(none.blocks.map((block) => block.blockId)).toEqual([first, second]);
    expect(none.blocks.every((block) => block.blockRole === null)).toBe(true);

    const roled = ok<DocumentRolesView>(
      await setDocumentRole({ documentId, documentRole: story.id }),
    );
    expect(roled.documentRole?.name).toBe("Story");
    // The assignment is the document's, not a candidate of anyone's: the
    // document's own revision is untouched by it.
    const document = ok<{ revisionId: string }>(await readDocument(documentId));
    expect(document.revisionId.startsWith("rev:")).toBe(true);

    const hooked = ok<DocumentRolesView>(
      await setBlockRole({ documentId, blockId: first, blockRole: hook }),
    );
    expect(hooked.blocks[0]!.blockRole).toMatchObject({
      id: hook,
      name: "Hook",
      documentRole: story.id,
      offered: true,
      retired: false,
    });
    expect(hooked.blocks[1]!.blockRole).toBeNull();
    expect(
      ok<DocumentRolesView>(await rolesOf(documentId)).blocks[0]!.blockRole?.id,
    ).toBe(hook);
    // Choosing what already stands writes nothing and answers the same.
    expect(
      ok<DocumentRolesView>(
        await setBlockRole({ documentId, blockId: first, blockRole: hook }),
      ).blocks[0]!.blockRole?.id,
    ).toBe(hook);
  });

  it("Given the document's role changed, Then the block keeps its role as not offered, and offered again when the role returns", async () => {
    await settle();
    const changed = ok<DocumentRolesView>(
      await setDocumentRole({ documentId, documentRole: essay.id }),
    );
    expect(changed.documentRole?.name).toBe("Essay");
    expect(changed.blocks[0]!.blockRole).toMatchObject({
      id: hook,
      offered: false,
    });
    await settle();
    const back = ok<DocumentRolesView>(
      await setDocumentRole({ documentId, documentRole: story.id }),
    );
    expect(back.blocks[0]!.blockRole).toMatchObject({
      id: hook,
      offered: true,
    });
  });

  it("Given a block role retired, Then the assignment stays and says so, and the role is not offered again", async () => {
    await settle();
    ok<DocumentRolesView>(
      await setBlockRole({ documentId, blockId: second, blockRole: closing }),
    );
    const retired = ok<DocumentRoleView>(
      await reviseDocumentRole(story.id, {
        command: "retireBlockRole",
        blockRole: closing,
      }),
    );
    expect(
      retired.blockRoles.find((role) => role.id === closing)?.retired,
    ).toBe(true);
    const read = ok<DocumentRolesView>(await rolesOf(documentId));
    expect(read.blocks[1]!.blockRole).toMatchObject({
      id: closing,
      retired: true,
    });
    await settle();
    const refused = await setBlockRole({
      documentId,
      blockId: first,
      blockRole: closing,
    });
    expect(refused.outcome).toBe("validationFailure");
    expect(JSON.stringify(refused)).toContain("retired");
    const restored = ok<DocumentRoleView>(
      await reviseDocumentRole(story.id, {
        command: "restoreBlockRole",
        blockRole: closing,
      }),
    );
    expect(
      restored.blockRoles.find((role) => role.id === closing)?.retired,
    ).toBe(false);
  });

  it("Given a role the document's role does not offer, an unknown role, a block outside the reading order or no document, Then each is refused in words", async () => {
    await settle();
    const notOffered = await setBlockRole({
      documentId,
      blockId: first,
      blockRole: thesis,
    });
    expect(notOffered.outcome).toBe("validationFailure");
    expect(JSON.stringify(notOffered)).toContain("Essay");
    expect(
      (await setBlockRole({ documentId, blockId: first, blockRole: NOWHERE }))
        .outcome,
    ).toBe("validationFailure");
    expect(
      (await setBlockRole({ documentId, blockId: NOWHERE, blockRole: hook }))
        .outcome,
    ).toBe("validationFailure");
    expect(
      (await setDocumentRole({ documentId, documentRole: NOWHERE })).outcome,
    ).toBe("validationFailure");
    expect(
      (await setDocumentRole({ documentId: NOWHERE, documentRole: null }))
        .outcome,
    ).toBe("validationFailure");
    expect((await rolesOf(NOWHERE)).outcome).toBe("validationFailure");
    const retiredRole = ok<DocumentRoleView>(
      await reviseDocumentRole(essay.id, { command: "retire" }),
    );
    expect(retiredRole.retired).toBe(true);
    const refused = await setDocumentRole({
      documentId,
      documentRole: essay.id,
    });
    expect(refused.outcome).toBe("validationFailure");
    expect(JSON.stringify(refused)).toContain("retired");
    await settle();
    expect(
      ok<DocumentRoleView>(
        await reviseDocumentRole(essay.id, { command: "restore" }),
      ).retired,
    ).toBe(false);
  });

  it("Given No role chosen for the block and then for the document, Then each assignment is cleared as truth, a bare close with its vantage", async () => {
    await settle();
    const cleared = ok<DocumentRolesView>(
      await setBlockRole({ documentId, blockId: second, blockRole: null }),
    );
    expect(cleared.blocks[1]!.blockRole).toBeNull();
    expect(cleared.blocks[0]!.blockRole?.id).toBe(hook);
    await settle();
    const none = ok<DocumentRolesView>(
      await setDocumentRole({ documentId, documentRole: null }),
    );
    expect(none.documentRole).toBeNull();
    // The block keeps its role and says it is not offered, since no document
    // role offers anything now.
    expect(none.blocks[0]!.blockRole).toMatchObject({
      id: hook,
      offered: false,
    });
    await settle();
    expect(
      ok<DocumentRolesView>(
        await setDocumentRole({ documentId, documentRole: story.id }),
      ).blocks[0]!.blockRole,
    ).toMatchObject({ id: hook, offered: true });
    await settle();
    ok<DocumentRolesView>(
      await setBlockRole({ documentId, blockId: second, blockRole: closing }),
    );
  });

  it("Given a run's call, Then read_document_roles answers the roles in reading order and refuses a missing document", async () => {
    const answer = await readDocumentRoles({
      input: { document: documentId },
      run: { id: "run", group: "group", pin: 0 },
    });
    const result = answer.result as DocumentRolesView & { note: string };
    expect(result.documentRole?.name).toBe("Story");
    expect(result.blocks.map((block) => block.blockRole?.name ?? null)).toEqual(
      ["Hook", "Closing"],
    );
    expect(result.note).toContain("Story");
    await expect(
      readDocumentRoles({
        input: {},
        run: { id: "run", group: "group", pin: 0 },
      }),
    ).rejects.toBeInstanceOf(ToolRefusal);
    await expect(
      readDocumentRoles({
        input: { document: NOWHERE },
        run: { id: "run", group: "group", pin: 0 },
      }),
    ).rejects.toBeInstanceOf(ToolRefusal);
  });
});
