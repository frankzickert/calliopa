import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MIGRATIONS as ROLE_MIGRATIONS } from "~/extensions/structures/server/migrations";
import { createStructure, documentsCarrying, setStructure } from "~/extensions/structures/server/structures";
import { INSTRUCTION_RECORD } from "~/extensions/documents/lib/instruction";
import { createDocument, deleteDocument, instructionSummary, readDocument } from "~/extensions/documents/server/documents";
import { write } from "~/server/ccgw/client";
import { readGraphEnv } from "~/server/ccgw/env";
import { nodeRef } from "~/server/ccgw/nodes";
import { call, jsonInit } from "~/server/kernel/client";

import { APPLY_A_STRUCTURE, BUILTIN_INSTRUCTIONS, EXTEND_A_STRUCTURE, FILL_A_FIELD_INSTRUCTION, SHAPE_AN_INSTRUCTION, INSTRUCTION_STRUCTURE, type GrantView, type InstructionChoices } from "../../lib/instructions";
import { choicesFor, createInstruction, forward, instructionInTheChip, instructionRecord } from "../../server/instructions";
import { builtinInstructions } from "../../server/builtins";
import { setStanding } from "../../server/standing";

/**
 * `instructions` over the one graph and the kernel (`calliopa-bootstrap`'s
 * `BO_0311_013`, the server side): an instruction created takes the built-in
 * *Instruction*; the chip is offered every instruction, those carrying a role the
 * document takes marked first, and the person's last instruction in the
 * document, none on an instruction's own; the upgrade migration gives an instruction
 * made before the role the role and drops a document's attached instruction,
 * then finds nothing left of either; and a grant and a revoke through the
 * kernel, the grant naming a code block as its tool. Runs under the kernel
 * harness like `documents`' suites.
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 350));

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome["result"] as T;
};

/** A write to a built-in another suite may have written a moment ago. */
const retried = async <T extends { outcome: string } & Record<string, unknown>>(act: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    const outcome = await act();
    const rule = outcome["outcome"] === "validationFailure" ? ((outcome["failures"] as { rule: string }[])[0]?.rule ?? "") : "";
    if (attempt >= 5 || rule !== "write_too_frequent") return outcome;
    await settle();
  }
};

const migrate = async (statement: { statement: string; parameters: Record<string, unknown> }, why: string) => {
  if (statement.statement !== "") ok(await retried(() => write(statement.statement, statement.parameters, why) as Promise<{ outcome: string } & Record<string, unknown>>));
  await settle();
};

const carrying = async (): Promise<string[]> => ok<readonly { id: string }[]>(await documentsCarrying(INSTRUCTION_STRUCTURE)).map((document) => document.id);

describe.skipIf(!configured)("instructions over CCGW", () => {
  let blog = "";
  let other = "";
  let legacy = "";
  let essay = "";
  const created: string[] = [];

  beforeAll(async () => {
    await migrate(ok(await ROLE_MIGRATIONS["builtin-roles"]!()), "the built-in roles");
    blog = ok<{ documentId: string }>(await createInstruction("Blog post")).documentId;
    other = ok<{ documentId: string }>(await createInstruction("Exploration")).documentId;
    legacy = ok<{ documentId: string }>(await createDocument({ title: "Made before the role", record: INSTRUCTION_RECORD })).documentId;
    essay = ok<{ documentId: string }>(await createDocument({ title: "Essay" })).documentId;
    created.push(blog, other, legacy, essay);
  });

  afterAll(async () => {
    for (const id of created) {
      const document = await readDocument(id);
      if (document.outcome === "success") {
        await settle();
        await deleteDocument({ documentId: id, baseRevisionId: document.result.revisionId });
      }
    }
  });

  it("Given an instruction created, Then it takes the built-in Instruction, and one made before the role does not yet", async () => {
    const holding = await carrying();
    expect(holding).toContain(blog);
    expect(holding).toContain(other);
    expect(holding).not.toContain(legacy);
  });

  it("Given a role the document and one instruction take, Then the chip marks that instruction first, and restores the person's last", async () => {
    const recipe = ok<{ id: string }>(await createStructure({ name: `Recipe ${Date.now()}` })).id;
    await settle();
    ok(await retried(() => setStructure({ documentId: blog, structure: recipe, taken: true }) as Promise<{ outcome: string } & Record<string, unknown>>));
    await settle();
    ok(await retried(() => setStructure({ documentId: essay, structure: recipe, taken: true }) as Promise<{ outcome: string } & Record<string, unknown>>));
    const essayDocument = ok<{ blocks: readonly { blockId: string }[] }>(await readDocument(essay));
    const block = essayDocument.blocks[0]?.blockId ?? "";

    let choices = ok<InstructionChoices>(await choicesFor(essay, block));
    expect(choices.isInstruction).toBe(false);
    expect(choices.last).toBeNull();
    expect(choices.instructions.find((instruction) => instruction.id === blog)?.matches).toBe(true);
    expect(choices.instructions.find((instruction) => instruction.id === other)?.matches).toBe(false);

    // The kernel keeps the person's last as a run starts; written here as the
    // kernel writes it.
    const kept = await call(`/__kernel/state/people/me/instruction/${encodeURIComponent(essay)}`, jsonInit("PUT", { instruction: other }));
    expect(kept.status).toBe(200);
    choices = ok<InstructionChoices>(await choicesFor(essay, block));
    expect(choices.last).toBe(other);

    const own = ok<InstructionChoices>(await choicesFor(blog, ""));
    expect(own.isInstruction).toBe(true);
    expect(own.last).toBeNull();
  });

  it("Given an instruction without the role and a document with an attached instruction, Then the migration gives the one and drops the other, and then finds nothing of either", async () => {
    await settle();
    ok(await retried(() => write("SET d.instruction = $p", { dNodeId: nodeRef(essay), p: blog }, "an attachment from before BO_0311") as Promise<{ outcome: string } & Record<string, unknown>>));
    await settle();
    const first = ok<{ statement: string; parameters: Record<string, unknown> }>(await instructionInTheChip());
    expect(Object.values(first.parameters)).toContain(nodeRef(legacy));
    expect(Object.values(first.parameters)).toContain(nodeRef(essay));
    expect(Object.values(first.parameters)).not.toContain(nodeRef(blog));
    await migrate(first, "the instruction in the chip");
    expect(await carrying()).toContain(legacy);
    const again = ok<{ parameters: Record<string, unknown> }>(await instructionInTheChip());
    expect(Object.values(again.parameters)).not.toContain(nodeRef(legacy));
    expect(Object.values(again.parameters)).not.toContain(nodeRef(essay));
  });

  it("Given an instruction with a code block, When the owner grants and revokes it, Then the kernel answers the tool granted and then offline", async () => {
    await settle();
    ok(await retried(() =>
      write(
        `CREATE (c:sourcecode {id: $cid, order: "z", source: "print('sent')", caption: "Send an email", status: "established"}); RELATE pref -[r:CONTAINS]-> cref`,
        { cid: `${blog}-send`, pref: nodeRef(blog), cref: nodeRef(`${blog}-send`) },
        "a tool in the instruction",
      ) as Promise<{ outcome: string } & Record<string, unknown>>,
    ));
    await settle();
    const before = await forward(`/__kernel/instructions/${encodeURIComponent(blog)}/grant`, { method: "GET" });
    expect(before.status).toBe(200);
    expect((before.body as GrantView).granted).toBe(false);
    expect((before.body as GrantView).tools).toEqual([{ block: `${blog}-send`, name: "send_an_email", description: "Send an email", state: "never" }]);

    const granted = await forward(`/__kernel/instructions/${encodeURIComponent(blog)}/grant`, jsonInit("PUT", { secrets: [] }));
    expect(granted.status).toBe(200);
    expect((granted.body as GrantView).granted).toBe(true);
    expect((granted.body as GrantView).tools[0]?.state).toBe("granted");

    const revoked = await forward(`/__kernel/instructions/${encodeURIComponent(blog)}/grant`, { method: "DELETE" });
    expect((revoked.body as GrantView).granted).toBe(false);
    expect((revoked.body as GrantView).tools[0]?.state).toBe("never");
  });
  it("Given a document taking Instruction, Then it is an instruction the chip offers, and clearing the role makes it a document again", async () => {
    const mailer = ok<{ documentId: string }>(await createDocument({ title: "Mailer" })).documentId;
    created.push(mailer);
    await settle();
    ok(await retried(() => setStructure({ documentId: mailer, structure: INSTRUCTION_STRUCTURE, taken: true }) as Promise<{ outcome: string } & Record<string, unknown>>));
    expect(ok<{ id: string } | null>(await instructionSummary(mailer))?.id).toBe(mailer);
    const offered = ok<InstructionChoices>(await choicesFor(essay, ""));
    expect(offered.instructions.map((instruction) => instruction.id)).toContain(mailer);
    await settle();
    ok(await retried(() => setStructure({ documentId: mailer, structure: INSTRUCTION_STRUCTURE, taken: false }) as Promise<{ outcome: string } & Record<string, unknown>>));
    expect(ok<unknown>(await instructionSummary(mailer))).toBeNull();
  });

  it("Given a document that took Instruction before taking it wrote the record, Then the migration gives it the record, and then finds nothing", async () => {
    const before = ok<{ documentId: string }>(await createDocument({ title: "Mailer from before" })).documentId;
    created.push(before);
    await settle();
    ok(await retried(() => write(`RELATE dref -[h:hasBlockRole]-> rref`, { dref: nodeRef(before), rref: nodeRef(INSTRUCTION_STRUCTURE) }, "the role without the record") as Promise<{ outcome: string } & Record<string, unknown>>));
    expect(ok<unknown>(await instructionSummary(before))).toBeNull();
    await settle();
    const first = ok<{ statement: string; parameters: Record<string, unknown> }>(await instructionRecord());
    expect(Object.values(first.parameters)).toContain(nodeRef(before));
    await migrate(first, "every carrier of Instruction is an instruction");
    expect(ok<{ id: string } | null>(await instructionSummary(before))?.id).toBe(before);
    expect(Object.values(ok<{ parameters: Record<string, unknown> }>(await instructionRecord()).parameters)).not.toContain(nodeRef(before));
  });

  it("Given the built-in instructions migration, Then Fill a field stands as an instruction using Instruction under its fixed id, with the release's words, and a second run makes nothing (BO_0349_033)", async () => {
    await settle();
    const first = ok<{ statement: string; parameters: Record<string, unknown> }>(await builtinInstructions());
    if (first.statement !== "") await migrate(first, "the built-in instructions");
    // Fill a field (BO_0349_033), Shape an instruction (BO_0349_014) and
    // Extend a structure (BO_0349_036).
    for (const release of BUILTIN_INSTRUCTIONS) {
      expect(ok<{ id: string; title: string } | null>(await instructionSummary(release.id))).toMatchObject({ id: release.id, title: release.title });
      expect(await carrying()).toContain(release.id);
      const read = ok<{ blocks: readonly { runs?: readonly { text: string }[] }[] }>(await readDocument(release.id));
      expect(read.blocks.map((block) => (block.runs ?? []).map((run) => run.text).join(""))).toEqual(release.words);
    }
    expect(BUILTIN_INSTRUCTIONS.map((release) => release.id)).toEqual([FILL_A_FIELD_INSTRUCTION, SHAPE_AN_INSTRUCTION, EXTEND_A_STRUCTURE, APPLY_A_STRUCTURE]);
    expect(ok<{ statement: string }>(await builtinInstructions()).statement).toBe("");
  });

  it("Given an instruction stood on a block and another on its document, Then each stands, a new one replaces the one standing, the chip starts with the block's over the document's, and taking it off leaves the document's (BO_0349_030, BO_0349_031)", async () => {
    const page = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "A page with standing instructions" }));
    const first = ok<{ documentId: string }>(await createInstruction("Short and plain")).documentId;
    const second = ok<{ documentId: string }>(await createInstruction("Long and warm")).documentId;
    await settle();
    ok(await retried(() => setStanding({ documentId: page.documentId, instruction: first }) as never));
    await settle();
    ok(await retried(() => setStanding({ documentId: page.documentId, blockId: page.blockId, instruction: first }) as never));
    await settle();
    const replaced = ok<{ document: { id: string } | null; blocks: Record<string, { id: string; title: string }> }>(
      await retried(() => setStanding({ documentId: page.documentId, blockId: page.blockId, instruction: second }) as never),
    );
    expect(replaced.document?.id).toBe(first);
    expect(replaced.blocks[page.blockId]).toMatchObject({ id: second, title: "Long and warm" });
    expect(ok<InstructionChoices>(await choicesFor(page.documentId, page.blockId)).standing).toBe(second);
    await settle();
    const off = ok<{ document: { id: string } | null; blocks: Record<string, unknown> }>(
      await retried(() => setStanding({ documentId: page.documentId, blockId: page.blockId, instruction: null }) as never),
    );
    expect(off.blocks[page.blockId]).toBeUndefined();
    expect(ok<InstructionChoices>(await choicesFor(page.documentId, page.blockId)).standing).toBe(first);
    // A document that is no instruction, and a block not in the reading order, are refused.
    const refusedAs = (outcome: { outcome: string; failures?: readonly { rule: string }[] }) => outcome.failures?.[0]?.rule;
    expect(refusedAs(await setStanding({ documentId: page.documentId, instruction: page.documentId }))).toBe("notAnInstruction");
    expect(refusedAs(await setStanding({ documentId: page.documentId, blockId: "00000000-0000-4000-8000-000000000000", instruction: first }))).toBe("unknownBlock");
  }, 60_000);

  it("Given a built-in instruction, Then deleting it is refused in words (BO_0349_035)", async () => {
    await settle();
    const read = ok<{ revisionId: string }>(await readDocument(FILL_A_FIELD_INSTRUCTION));
    const refused = await deleteDocument({ documentId: FILL_A_FIELD_INSTRUCTION, baseRevisionId: read.revisionId });
    expect(refused.outcome).not.toBe("success");
    expect(JSON.stringify(refused)).toContain("Fill a field is built in");
    expect(ok<{ id: string } | null>(await instructionSummary(FILL_A_FIELD_INSTRUCTION))?.id).toBe(FILL_A_FIELD_INSTRUCTION);
  });
});

