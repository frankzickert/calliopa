import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerDocumentGroup,
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  insertBlock,
  mergeTextBlocks,
  proposeDocumentChanges,
  readDocument,
  readDocumentProposals,
  renameDocument,
  retireBlock,
  turnIntoCode,
} from "~/extensions/documents/server/documents";
import { decide, query, stage, touchedSet, write } from "~/server/ccgw/client";
import { asRun, withBranch } from "~/server/ccgw/branch-scope";
import { DOCUMENT_TARGET_KIND } from "~/extensions/documents/server/focus";
import { readGraphEnv } from "~/server/ccgw/env";
import { openFocusedWork } from "~/server/focused-work";
import { nodeRef } from "~/server/ccgw/nodes";

import {
  FIELD_STRUCTURE,
  FORMAT_STRUCTURE,
  INSTRUCTION_STRUCTURE,
  KEYWORD_STRUCTURE,
  DEFINITION_STRUCTURE,
  ALIAS_STRUCTURE,
  SOURCE_STRUCTURE,
  STRUCTURE_STRUCTURE,
  VARIATION_STRUCTURE,
  INPUT_STRUCTURE,
  BUILTIN_STRUCTURES,
  type DocumentStructuresView,
  type StructureView,
} from "../../lib/structures";
import { MIGRATIONS } from "../../server/migrations";
import {
  createStructure,
  documentsCarrying,
  guardOf,
  listStructures,
  proposeStructures,
  readStructure,
  reviseStructure,
  structuresOf,
  setStructure,
  setValues,
} from "../../server/structures";
import { proposeStructuresTool, readDocumentStructures, ToolRefusal } from "../../server/tools";
import "../../contributions.server";

/**
 * Structures over the one graph, a structure being a document using the
 * built-in *Structure* and each field a block using *Field* (`RO_0005_006`):
 * the migration moving every `blockRole` to a document and keeping what hung
 * on it; a structure shaped through its document — its title its name, its
 * blocks its description, a block given *Field* a field keyed from its words,
 * what it allows a value of *Structure*; *Structure* never used by hand and
 * *Field* never on *Structure* or *Field*; what the release fixes refused in
 * words, and `documents`' guards keeping a structure's document, a built-in's
 * title and its release fields' blocks, a run's removal refused as it is
 * accepted. And what held before: several structures on one block; allowing
 * from above, never to the block carrying the allowing structure
 * (`BO_0309_Q1`); values kept apart, refused by type, a default filled in; a
 * structure for documents alone (`BO_0332_014`); focused work under a
 * structured block; a run's proposal standing only once accepted. Runs under
 * the kernel harness like `documents.test.ts`.
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

const refusedAs = (outcome: { outcome: string } & Record<string, unknown>): string =>
  outcome["outcome"] === "validationFailure" ? ((outcome["failures"] as { rule: string }[])[0]?.rule ?? "") : outcome["outcome"];

const NOWHERE = "00000000-0000-4000-8000-000000000000";

/** A write to a built-in another suite may have written a moment ago, tried
 * again past the kernel's per-node floor. */
const retried = async <T extends { outcome: string } & Record<string, unknown>>(act: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    const outcome = await act();
    if (attempt >= 5 || refusedAs(outcome) !== "write_too_frequent") return outcome;
    await settle();
  }
};

/** The structures as documents, as an instance serving the pin writes them. */
const migrate = async (): Promise<void> => {
  const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["structures-as-documents"]!());
  if (statement.statement !== "") ok(await retried(() => write(statement.statement, statement.parameters, "structures as documents") as never));
  await settle();
};

/** A field added as a person adds one: a block in the structure's document
 * with the field's name as its words, given *Field* and its values. */
const addField = async (structureId: string, name: string, values: Record<string, unknown> = {}): Promise<string> => {
  const document = ok<{ blocks: readonly { blockId: string }[] }>(await readDocument(structureId));
  const last = document.blocks.at(-1)!.blockId;
  const block = ok<{ blockId: string }>(
    await insertBlock({ documentId: structureId, block: { kind: "text", runs: [{ text: name }] }, placement: { after: last } }),
  ).blockId;
  await settle();
  ok(await setStructure({ documentId: structureId, blockId: block, structure: FIELD_STRUCTURE, taken: true }));
  await settle();
  if (Object.keys(values).length > 0) {
    ok(await setValues({ documentId: structureId, blockId: block, structure: FIELD_STRUCTURE, values }));
    await settle();
  }
  return block;
};

/** What a structure allows, set as the value of *Structure* in its header. */
const allow = async (structureId: string, allowed: readonly string[]): Promise<StructureView> => {
  ok(await setValues({ documentId: structureId, structure: STRUCTURE_STRUCTURE, values: { allows: allowed } }));
  await settle();
  return ok<StructureView>(await readStructure(structureId));
};

describe.skipIf(!configured)("structures over CCGW", () => {
  let documentId = "";
  let first = "";
  let second = "";
  let story: StructureView;
  let hook: StructureView;
  let line: StructureView;
  let blog: StructureView;
  let event: StructureView;

  beforeAll(async () => {
    await migrate();
    const created = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "A structured document" }));
    documentId = created.documentId;
    first = created.blockId;
    await settle();
    second = ok<{ blockId: string }>(await insertBlock({ documentId, block: { kind: "text" }, placement: { after: first } })).blockId;
    story = ok<StructureView>(await createStructure({ name: "Story", description: "A story with a hook" }));
    hook = ok<StructureView>(await createStructure({ name: "Hook", description: "Opens the story" }));
    line = ok<StructureView>(await createStructure({ name: "Line" }));
    blog = ok<StructureView>(await createStructure({ name: "Blog post" }));
    event = ok<StructureView>(await createStructure({ name: "Event" }));
    await settle();
    story = await allow(story.id, [hook.id]);
    hook = await allow(hook.id, [line.id]);
    await addField(blog.id, "Date", { type: "Date", required: true });
    await addField(blog.id, "Position", { type: "Number", default: 1 });
    await addField(event.id, "Date", { type: "Date" });
    blog = ok<StructureView>(await readStructure(blog.id));
    event = ok<StructureView>(await readStructure(event.id));
  }, 60_000);

  afterAll(async () => {
    const document = await readDocument(documentId);
    if (document.outcome === "success") {
      await settle();
      await deleteDocument({ documentId, baseRevisionId: document.result.revisionId });
    }
  });

  it("Given the migration, Then every built-in stands as a document under its fixed id, named by the release, and a second run answers nothing", async () => {
    const listed = ok<StructureView[]>(await listStructures());
    expect(listed.slice(0, BUILTIN_STRUCTURES.length).map((structure) => [structure.id, structure.name, structure.builtin])).toEqual(
      BUILTIN_STRUCTURES.map((release) => [release.id, release.name, true]),
    );
    // The built-ins answer by the ids they had as well.
    expect(ok<StructureView>(await readStructure("builtin:keyword")).id).toBe(KEYWORD_STRUCTURE);
    expect(ok<StructureView>(await readStructure("builtin:profile")).name).toBe("Instruction");
    const keyword = ok<StructureView>(await readStructure(KEYWORD_STRUCTURE));
    expect(keyword.offers).toEqual(expect.arrayContaining([DEFINITION_STRUCTURE, ALIAS_STRUCTURE]));
    expect(keyword.sendWithPrompt).toBeDefined();
    const structure = ok<StructureView>(await readStructure(STRUCTURE_STRUCTURE));
    expect([structure.blocks, structure.offers, structure.fields.map((field) => field.key)]).toEqual([false, [FIELD_STRUCTURE], ["blocks", "allows"]]);
    expect(ok<StructureView>(await readStructure(FIELD_STRUCTURE)).fields.map((field) => field.key)).toEqual([
      "type",
      "required",
      "many",
      "options",
      "default",
      "suggest",
      "suggestions",
      "carrying",
    ]);
    // Each built-in's release fields stand as blocks of its document.
    const format = ok<StructureView>(await readStructure(FORMAT_STRUCTURE));
    expect(format.fields.every((field) => field.blockId !== undefined)).toBe(true);
    expect(ok<{ statement: string }>(await MIGRATIONS["structures-as-documents"]!()).statement).toBe("");
  });

  it("Given structures as nodes from before, Then the migration makes each a document keeping its fields by key, what it allowed, its uses and their values", async () => {
    const essay = crypto.randomUUID();
    const thesis = crypto.randomUUID();
    const valuesId = crypto.randomUUID();
    const held = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Structured before" }));
    await settle();
    ok(
      await write(
        [
          `CREATE (e:blockRole {id: $e_id, name: "Essay", description: "A long argument", order: 3, blocks: false, fields: $e_fields, status: "established"})`,
          `CREATE (t:blockRole {id: $t_id, name: "Thesis", order: 4, retired: true, status: "established"})`,
          "RELATE eref -[o:offers]-> tref",
          "RELATE dref -[h:hasBlockRole]-> eref",
          "RELATE bref -[h2:hasBlockRole]-> tref",
          `CREATE (f:roleFields {id: $f_id, role: $e_id, values: $f_values, status: "established"})`,
          "RELATE fref -[fo:fieldsOf]-> dref",
          "RELATE fref -[ff:fieldsFor]-> eref",
        ].join("; "),
        {
          e_id: essay,
          t_id: thesis,
          e_fields: [
            { key: "citationStyle", name: "Citation style", type: "choice", required: true, options: ["APA", "MLA"] },
            { key: "4f0c7a0e-1111-4a7b-9b9b-000000000001", name: "Pages", type: "number", required: false, default: 10 },
          ],
          f_id: valuesId,
          f_values: { citationStyle: "APA", "4f0c7a0e-1111-4a7b-9b9b-000000000001": 12 },
          eref: nodeRef(essay),
          tref: nodeRef(thesis),
          dref: nodeRef(held.documentId),
          bref: nodeRef(held.blockId),
          fref: nodeRef(valuesId),
        },
        "structures as nodes, from before",
      ),
    );
    await settle();
    await migrate();
    const moved = ok<StructureView>(await readStructure(essay));
    expect(moved.id).not.toBe(essay);
    expect(moved).toMatchObject({ name: "Essay", description: "A long argument", blocks: false, retired: false, formerIds: [essay] });
    expect(moved.fields.map((field) => [field.key, field.name, field.type, field.required])).toEqual([
      ["citationStyle", "Citation style", "choice", true],
      ["4f0c7a0e-1111-4a7b-9b9b-000000000001", "Pages", "number", false],
    ]);
    expect(moved.fields[0]!.options).toEqual(["APA", "MLA"]);
    expect(moved.fields[1]!.default).toBe(10);
    const thesisNow = ok<StructureView>(await readStructure(thesis));
    expect(thesisNow.retired).toBe(true);
    expect(moved.offers).toEqual([thesisNow.id]);
    const view = ok<DocumentStructuresView>(await structuresOf(held.documentId));
    expect(view.structures.map((structure) => [structure.id, structure.values])).toEqual([
      [moved.id, { citationStyle: "APA", "4f0c7a0e-1111-4a7b-9b9b-000000000001": 12 }],
    ]);
    expect(view.blocks[0]!.structures.map((structure) => structure.id)).toEqual([thesisNow.id]);
    expect(ok<{ statement: string }>(await MIGRATIONS["structures-as-documents"]!()).statement).toBe("");
  }, 30_000);

  it("Given a structure shaped in its document, Then its title names it, its blocks describe it, a block given Field is a field keyed from its words, and its order is the blocks'", async () => {
    let venue = ok<StructureView>(await createStructure({ name: "Venue under test", description: "Where a paper goes" }));
    expect([venue.name, venue.description, venue.blocks, venue.fields, venue.offers]).toEqual(["Venue under test", "Where a paper goes", true, [], []]);
    // The document using it is a document, listed under its title.
    expect(ok<{ title: string }>(await readDocument(venue.id)).title).toBe("Venue under test");
    await settle();
    const style = await addField(venue.id, "Citation style", { type: "Choice", options: "APA\nMLA\n\nAPA" });
    await addField(venue.id, "Citation style", { type: "Text" });
    venue = ok<StructureView>(await readStructure(venue.id));
    expect(venue.fields.map((field) => [field.key, field.name, field.type, field.blockId])).toEqual([
      ["citationStyle", "Citation style", "choice", style],
      ["citationStyle2", "Citation style", "text", expect.any(String)],
    ]);
    expect(venue.fields[0]!.options).toEqual(["APA", "MLA"]);
    // Renamed through its title, the structure is renamed; the key stays.
    const document = ok<{ revisionId: string }>(await readDocument(venue.id));
    ok(await renameDocument({ documentId: venue.id, baseRevisionId: document.revisionId, title: "Journal" }));
    await settle();
    expect(ok<StructureView>(await readStructure(venue.id)).name).toBe("Journal");
    // Default takes the type Type names: a choice refuses what it does not offer.
    expect(refusedAs(await setValues({ documentId: venue.id, blockId: style, structure: FIELD_STRUCTURE, values: { default: "Chicago" } }))).toBe("valueShape");
    ok(await setValues({ documentId: venue.id, blockId: style, structure: FIELD_STRUCTURE, values: { default: "MLA" } }));
    await settle();
    expect(ok<StructureView>(await readStructure(venue.id)).fields[0]!.default).toBe("MLA");
    // What it allows, and that it never allows itself.
    expect(refusedAs(await setValues({ documentId: venue.id, structure: STRUCTURE_STRUCTURE, values: { allows: [venue.id] } }))).toBe("offersItself");
    expect(refusedAs(await setValues({ documentId: venue.id, structure: STRUCTURE_STRUCTURE, values: { allows: [documentId] } }))).toBe("notCarrying");
    const section = ok<StructureView>(await createStructure({ name: "Section under test" }));
    await settle();
    expect((await allow(venue.id, [section.id])).offers).toEqual([section.id]);
    ok(await setValues({ documentId: venue.id, structure: STRUCTURE_STRUCTURE, values: { blocks: false } }));
    await settle();
    expect(ok<StructureView>(await readStructure(venue.id)).blocks).toBe(false);
    // Retired and restored by act, never by a value.
    expect(refusedAs(await setValues({ documentId: venue.id, structure: STRUCTURE_STRUCTURE, values: { retired: true } }))).toBe("unknownField");
    expect(ok<StructureView>(await reviseStructure(venue.id, { command: "retire" })).retired).toBe(true);
    await settle();
    expect(ok<StructureView>(await reviseStructure(venue.id, { command: "restore" })).retired).toBe(false);
  }, 30_000);

  it("Given Structure and Field, Then a structure is made only by Structures' +, Structure never cleared, and Field never on Structure or Field", async () => {
    const plain = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Not a structure" }));
    await settle();
    const view = ok<DocumentStructuresView>(await structuresOf(plain.documentId));
    expect(view.takeable).not.toContain(STRUCTURE_STRUCTURE);
    expect(view.blocks[0]!.takeable).not.toContain(FIELD_STRUCTURE);
    expect(refusedAs(await setStructure({ documentId: plain.documentId, structure: STRUCTURE_STRUCTURE, taken: true }))).toBe("structureFromStructures");
    expect(refusedAs(await setStructure({ documentId: story.id, structure: STRUCTURE_STRUCTURE, taken: false }))).toBe("structureFromStructures");
    // On a structure's document, Field is allowed to its blocks.
    const storyBlock = ok<DocumentStructuresView>(await structuresOf(story.id)).blocks[0]!;
    expect(storyBlock.takeable).toContain(FIELD_STRUCTURE);
    const own = ok<DocumentStructuresView>(await structuresOf(STRUCTURE_STRUCTURE));
    const free = own.blocks.find((block) => block.structures.length === 0)!;
    expect(refusedAs(await setStructure({ documentId: STRUCTURE_STRUCTURE, blockId: free.blockId, structure: FIELD_STRUCTURE, taken: true }))).toBe("builtinField");
  });

  it("Given what the release fixes, Then a built-in's Blocks may use, its release allows and its release fields are refused in words, and its title is never changed", async () => {
    expect(refusedAs(await setValues({ documentId: FORMAT_STRUCTURE, structure: STRUCTURE_STRUCTURE, values: { blocks: true } }))).toBe("builtinBlocks");
    expect(refusedAs(await setValues({ documentId: KEYWORD_STRUCTURE, structure: STRUCTURE_STRUCTURE, values: { allows: [DEFINITION_STRUCTURE] } }))).toBe("builtinOffer");
    const type = ok<StructureView>(await readStructure(FORMAT_STRUCTURE)).fields.find((field) => field.key === "type")!;
    expect(refusedAs(await setValues({ documentId: FORMAT_STRUCTURE, blockId: type.blockId!, structure: FIELD_STRUCTURE, values: { type: "Text" } }))).toBe("builtinField");
    expect(refusedAs(await setStructure({ documentId: FORMAT_STRUCTURE, blockId: type.blockId!, structure: FIELD_STRUCTURE, taken: false }))).toBe("builtinField");
    expect(refusedAs(await reviseStructure(KEYWORD_STRUCTURE, { command: "retire" }))).toBe("builtinStructure");
    const keyword = ok<{ revisionId: string }>(await readDocument(KEYWORD_STRUCTURE));
    expect(refusedAs(await renameDocument({ documentId: KEYWORD_STRUCTURE, baseRevisionId: keyword.revisionId, title: "Tag" }))).toBe("titleFixed");
  });

  it("Given documents' guards, Then a structure's document is never deleted, a built-in's release field block never leaves it, and a person's own field block does", async () => {
    const fixed = ok<{ undeletable?: string; title?: string; blocks: Record<string, string> }>(await guardOf(SOURCE_STRUCTURE));
    expect(fixed.undeletable).toContain("Source is a structure");
    expect(fixed.title).toContain("built in");
    const source = ok<StructureView>(await readStructure(SOURCE_STRUCTURE));
    expect(Object.keys(fixed.blocks).sort()).toEqual(source.fields.map((field) => field.blockId!).sort());
    expect(ok<{ blocks: Record<string, string> }>(await guardOf(documentId)).blocks).toEqual({});

    const storyRead = ok<{ revisionId: string }>(await readDocument(story.id));
    expect(refusedAs(await deleteDocument({ documentId: story.id, baseRevisionId: storyRead.revisionId }))).toBe("documentFixed");
    const kind = source.fields.find((field) => field.key === "kind")!.blockId!;
    expect(refusedAs(await retireBlock({ documentId: SOURCE_STRUCTURE, blockId: kind }))).toBe("blockFixed");
    const read = ok<{ blocks: readonly { blockId: string; revisionId: string; kind: string }[] }>(await readDocument(SOURCE_STRUCTURE));
    const at = read.blocks.findIndex((block) => block.blockId === kind);
    const before = read.blocks[at - 1]!;
    expect(refusedAs(await mergeTextBlocks({ documentId: SOURCE_STRUCTURE, intoBlockId: before.blockId, intoBaseRevisionId: before.revisionId, blockId: kind }))).toBe("blockFixed");
    expect(refusedAs(await turnIntoCode({ documentId: SOURCE_STRUCTURE, blockId: kind, baseRevisionId: read.blocks[at]!.revisionId }))).toBe("blockFixed");
    // A run's removal of it is staged by whoever stages it, and refused as it is accepted.
    const staged = ok<{ items: readonly { itemId: string }[] }>(await proposeDocumentChanges({ documentId: SOURCE_STRUCTURE, items: [{ kind: "remove", blockId: kind }] }));
    expect(refusedAs(await answerDocumentProposal({ documentId: SOURCE_STRUCTURE, itemId: staged.items[0]!.itemId, answer: "accepted" }))).toBe("blockFixed");
    expect(ok<StructureView>(await readStructure(SOURCE_STRUCTURE)).fields.find((field) => field.key === "kind")?.blockId).toBe(kind);
    // A person's own field leaves with its block.
    const scratch = ok<StructureView>(await createStructure({ name: "Scratch" }));
    await settle();
    const note = await addField(scratch.id, "Note");
    expect(ok<StructureView>(await readStructure(scratch.id)).fields.map((field) => field.name)).toEqual(["Note"]);
    ok(await retireBlock({ documentId: scratch.id, blockId: note }));
    await settle();
    expect(ok<StructureView>(await readStructure(scratch.id)).fields).toEqual([]);
  }, 30_000);

  it("Given structures allowing structures, Then the catalogue lists each with what it allows and its fields", async () => {
    const listed = ok<StructureView[]>(await listStructures());
    const found = (id: string) => listed.find((structure) => structure.id === id)!;
    expect(found(story.id).offers).toEqual([hook.id]);
    expect(found(hook.id).offeredBy).toEqual([story.id]);
    expect(found(line.id).offeredBy).toEqual([hook.id]);
    expect(found(blog.id).fields.map((field) => [field.name, field.type, field.required])).toEqual([
      ["Date", "date", true],
      ["Position", "number", false],
    ]);
    expect(found(blog.id).fields[1]!.default).toBe(1);
    expect(found(story.id).description).toBe("A story with a hook");
    expect(refusedAs(await readStructure(NOWHERE))).toBe("unknownStructure");
  });

  it("Given a Story document, Then a block uses several structures, one allowed from above, and a structure is never allowed to the block carrying its allowing structure", async () => {
    const none = ok<DocumentStructuresView>(await structuresOf(documentId));
    expect(none.structures).toEqual([]);
    expect(none.blocks.map((block) => block.blockId)).toEqual([first, second]);
    expect(none.blocks[0]!.takeable).not.toContain(hook.id);
    expect(refusedAs(await setStructure({ documentId, blockId: first, structure: hook.id, taken: true }))).toBe("notOffered");

    const storied = ok<DocumentStructuresView>(await setStructure({ documentId, structure: story.id, taken: true }));
    expect(storied.takeable).not.toContain(hook.id);
    expect(storied.blocks[0]!.takeable).toContain(hook.id);
    await settle();
    ok(await setStructure({ documentId, blockId: first, structure: hook.id, taken: true }));
    await settle();
    const two = ok<DocumentStructuresView>(await setStructure({ documentId, blockId: first, structure: event.id, taken: true }));
    expect(two.structures.map((structure) => structure.name)).toEqual(["Story"]);
    expect(two.blocks[0]!.structures.map((structure) => structure.name).sort()).toEqual(["Event", "Hook"]);
    expect(two.blocks[0]!.takeable).not.toContain(line.id);
    expect(two.blocks[1]!.takeable).toContain(hook.id);
    expect(two.blocks[1]!.takeable).not.toContain(line.id);
    expect(refusedAs(await setStructure({ documentId, blockId: first, structure: line.id, taken: true }))).toBe("notOffered");
    expect(refusedAs(await setStructure({ documentId, blockId: NOWHERE, structure: hook.id, taken: true }))).toBe("unknownBlock");
  });

  it("Given Story cleared from the document, Then Hook stays on the block and says it is not allowed", async () => {
    await settle();
    const cleared = ok<DocumentStructuresView>(await setStructure({ documentId, structure: story.id, taken: false }));
    expect(cleared.structures).toEqual([]);
    expect(cleared.blocks[0]!.structures.find((structure) => structure.id === hook.id)!.offered).toBe(false);
    await settle();
    const again = ok<DocumentStructuresView>(await setStructure({ documentId, structure: story.id, taken: true }));
    expect(again.blocks[0]!.structures.find((structure) => structure.id === hook.id)!.offered).toBe(true);
  });

  it("Given a block using two structures with a field of the same name, Then each structure's values are kept apart, a default is filled in on using, and a value of the wrong type is refused", async () => {
    await settle();
    const date = blog.fields[0]!.key;
    const position = blog.fields[1]!.key;
    const taken = ok<DocumentStructuresView>(await setStructure({ documentId, blockId: second, structure: blog.id, taken: true }));
    const blogOn = () => taken.blocks[1]!.structures.find((structure) => structure.id === blog.id)!;
    expect(blogOn().values).toEqual({ [position]: 1 });
    expect(blogOn().missing).toEqual([date]);
    await settle();
    ok(await setStructure({ documentId, blockId: second, structure: event.id, taken: true }));
    await settle();
    ok(await setValues({ documentId, blockId: second, structure: blog.id, values: { [date]: "2026-10-01" } }));
    await settle();
    const both = ok<DocumentStructuresView>(await setValues({ documentId, blockId: second, structure: event.id, values: { [event.fields[0]!.key]: "2026-12-24" } }));
    const on = (id: string) => both.blocks[1]!.structures.find((structure) => structure.id === id)!;
    expect(on(blog.id).values).toEqual({ [date]: "2026-10-01", [position]: 1 });
    expect(on(event.id).values).toEqual({ [event.fields[0]!.key]: "2026-12-24" });
    expect(refusedAs(await setValues({ documentId, blockId: second, structure: blog.id, values: { [date]: "1 October" } }))).toBe("valueShape");
    expect(refusedAs(await setValues({ documentId, blockId: second, structure: blog.id, values: { nothing: "x" } }))).toBe("unknownField");
    expect(refusedAs(await setValues({ documentId, blockId: first, structure: blog.id, values: {} }))).toBe("structureNotTaken");
  });

  it("Given a run proposing a value and a structure, Then it is staged and nothing stands until it is accepted, and a run may propose Structure for a document", async () => {
    await settle();
    const date = blog.fields[0]!.key;
    const staged = ok<readonly { statement: string }[]>(
      await proposeStructures({ documentId, blockId: first, take: [blog.id], clear: [event.id], values: { [blog.id]: { [date]: "2026-11-11" } } }),
    );
    expect(staged.map((each) => each.statement.split("; ")[0]!.split(" ")[0])).toEqual(["RELATE", "CLOSE", "CREATE"]);
    const answer = await proposeStructuresTool({ input: { document: documentId, block: first, use: [blog.id] }, run: { id: "arun-test", group: "", pin: 0 } });
    expect(answer.stage).toHaveLength(1);
    expect(ok<DocumentStructuresView>(await structuresOf(documentId)).blocks[0]!.structures.map((structure) => structure.id)).not.toContain(blog.id);
    await expect(proposeStructuresTool({ input: { document: documentId, block: second, use: [line.id] }, run: { id: "arun-test", group: "", pin: 0 } })).rejects.toThrow(ToolRefusal);
    // A run proposes a structure by giving a document Structure, never a block.
    const draft = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "A structure a run proposes" }));
    await settle();
    expect(ok<readonly unknown[]>(await proposeStructures({ documentId: draft.documentId, take: [STRUCTURE_STRUCTURE], clear: [], values: {} }))).toHaveLength(1);
    expect(refusedAs(await proposeStructures({ documentId: draft.documentId, blockId: draft.blockId, take: [STRUCTURE_STRUCTURE], clear: [], values: {} }))).toBe("structureFromStructures");
  });

  it("Given the tool, Then it answers the structures with their values and what each block can use, and a structure's whole text", async () => {
    const answer = (await readDocumentStructures({ input: { document: documentId }, run: { id: "arun-test", group: "", pin: 0 } })).result as {
      structures: { name: string; description: string }[];
      blocks: { blockId: string; structures: { name: string; fields: { name: string; value: string }[] }[]; usable: string[] }[];
      note: string;
    };
    expect(answer.structures.find((structure) => structure.name === "Story")?.description).toBe("A story with a hook");
    expect(answer.blocks[0]!.usable).toContain(hook.id);
    expect(answer.note).toContain("propose_structures");
    await expect(readDocumentStructures({ input: { document: NOWHERE }, run: { id: "arun-test", group: "", pin: 0 } })).rejects.toThrow(ToolRefusal);
  });

  it("Given a Story block opened as focused work, Then the focused work stands under Story and its blocks use Hook", async () => {
    const outline = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "An outline" }));
    await settle();
    ok(await setStructure({ documentId: outline.documentId, blockId: outline.blockId, structure: story.id, taken: true }));
    const work = ok<{ itemId: string }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: outline.documentId, blockId: outline.blockId })).itemId;
    await settle();
    const under = ok<DocumentStructuresView>(await structuresOf(work));
    expect(under.inherited.map((structure) => [structure.name, structure.on, structure.document])).toEqual([["Story", outline.blockId, outline.documentId]]);
    expect(under.blocks[0]!.takeable).toContain(hook.id);
    expect(under.blocks[0]!.takeable).not.toContain(line.id);
  });

  it("Given a structure for documents alone, Then no block uses it while the document does, a block carrying it keeps it and says so, and the built-ins are the document's alone", async () => {
    const page = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Document structures" }));
    await settle();
    const other = ok<{ blockId: string }>(await insertBlock({ documentId: page.documentId, block: { kind: "text" }, placement: { after: page.blockId } })).blockId;
    const chapter = ok<StructureView>(await createStructure({ name: "Chapter" }));
    await settle();
    ok(await setStructure({ documentId: page.documentId, blockId: page.blockId, structure: chapter.id, taken: true }));
    ok(await setValues({ documentId: chapter.id, structure: STRUCTURE_STRUCTURE, values: { blocks: false } }));
    await settle();
    const view = ok<DocumentStructuresView>(await structuresOf(page.documentId));
    expect(view.takeable).toContain(chapter.id);
    expect(view.blocks.map((block) => block.takeable.includes(chapter.id))).toEqual([false, false]);
    expect(view.blocks[0]!.structures.find((structure) => structure.id === chapter.id)).toMatchObject({ notOnBlock: true, blocks: false });
    expect(refusedAs(await setStructure({ documentId: page.documentId, blockId: other, structure: chapter.id, taken: true }))).toBe("blockNotAllowed");
    for (const builtin of [KEYWORD_STRUCTURE, INSTRUCTION_STRUCTURE, FORMAT_STRUCTURE, SOURCE_STRUCTURE])
      expect(refusedAs(await setStructure({ documentId: page.documentId, blockId: other, structure: builtin, taken: true }))).toBe("blockNotAllowed");
    expect(ok<DocumentStructuresView>(await setStructure({ documentId: page.documentId, structure: FORMAT_STRUCTURE, taken: true })).structures.map((structure) => structure.id)).toContain(FORMAT_STRUCTURE);
    expect(ok<readonly { id: string }[]>(await documentsCarrying(FORMAT_STRUCTURE)).map((document) => document.id)).toContain(page.documentId);
  }, 30_000);

  it("Given the generation fields, Then Format allows Variation, an instruction's format takes only a document using Format, and Keyword sends what is switched on", async () => {
    const format = ok<StructureView>(await readStructure(FORMAT_STRUCTURE));
    expect(format.offers).toContain(VARIATION_STRUCTURE);
    expect(format.fields.filter((field) => field.suggest !== undefined).map((field) => [field.key, field.suggest])).toEqual([
      ["provider", "media:provider"],
      ["model", "media:model"],
      ["ratio", "media:ratio"],
      ["quality", "media:quality"],
    ]);
    expect(ok<StructureView>(await readStructure(INSTRUCTION_STRUCTURE)).fields.find((field) => field.key === "format")).toMatchObject({ type: "reference", carrying: FORMAT_STRUCTURE });
    const square = ok<{ documentId: string }>(await createDocument({ title: "Instagram square" }));
    const instruction = ok<{ documentId: string }>(await createDocument({ title: "Image instruction" }));
    const plain = ok<{ documentId: string }>(await createDocument({ title: "Not a format" }));
    await settle();
    ok(await setStructure({ documentId: square.documentId, structure: FORMAT_STRUCTURE, taken: true }));
    ok(await setStructure({ documentId: instruction.documentId, structure: INSTRUCTION_STRUCTURE, taken: true }));
    await settle();
    expect(refusedAs(await setValues({ documentId: instruction.documentId, structure: INSTRUCTION_STRUCTURE, values: { format: plain.documentId } }))).toBe("notCarrying");
    const named = ok<DocumentStructuresView>(await setValues({ documentId: instruction.documentId, structure: INSTRUCTION_STRUCTURE, values: { format: square.documentId } }));
    expect(named.referenceTitles?.[square.documentId]).toBe("Instagram square");
    // Keyword's Send with prompt, switched per entry.
    const on = ok<StructureView>(await retried(() => reviseStructure(KEYWORD_STRUCTURE, { command: "sendWithPrompt", entry: DEFINITION_STRUCTURE, on: true })));
    expect(on.sendWithPrompt).toContain(DEFINITION_STRUCTURE);
    expect(refusedAs(await reviseStructure(story.id, { command: "sendWithPrompt", entry: DEFINITION_STRUCTURE, on: true }))).toBe("sendWithPrompt");
    expect(refusedAs(await reviseStructure(KEYWORD_STRUCTURE, { command: "sendWithPrompt", entry: "nothing-here", on: true }))).toBe("sendWithPrompt");
    // A structure made now is a document, never a node of the type before.
    const nodes = await query({ statement: "MATCH (r:blockRole) RETURN GRAPH r", unbounded: true, purpose: "test" });
    expect(nodes.outcome === "success" ? nodes.result.nodes.every((node) => node.id !== nodeRef(story.id)) : true).toBe(true);
  }, 30_000);

  // ME_0002_002: a format's input is a block using Input, which the release
  // has Format allow and an instance holding the other built-ins is given.
  it("Given Input, Then Format allows it, a block of a format document takes it with its kind and name, its title is fixed, and its migration answers nothing once it stands", async () => {
    expect(ok<StructureView>(await readStructure(FORMAT_STRUCTURE)).offers).toContain(INPUT_STRUCTURE);
    const input = ok<StructureView>(await readStructure(INPUT_STRUCTURE));
    expect([input.name, input.builtin, input.fields.map((field) => field.key)]).toEqual(["Input", true, ["kind", "name", "required"]]);
    const clip = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Product clip" }));
    await settle();
    ok(await setStructure({ documentId: clip.documentId, structure: FORMAT_STRUCTURE, taken: true }));
    const opening = ok<{ blockId: string }>(
      await insertBlock({ documentId: clip.documentId, block: { kind: "text", runs: [{ text: "The product shot the clip opens on" }] }, placement: { after: clip.blockId } }),
    ).blockId;
    await settle();
    ok(await setStructure({ documentId: clip.documentId, blockId: opening, structure: INPUT_STRUCTURE, taken: true }));
    await settle();
    ok(await setValues({ documentId: clip.documentId, blockId: opening, structure: INPUT_STRUCTURE, values: { kind: "Start frame", name: "start", required: true } }));
    await settle();
    const taken = ok<DocumentStructuresView>(await structuresOf(clip.documentId));
    expect(taken.blocks.find((block) => block.blockId === opening)?.structures.find((one) => one.id === INPUT_STRUCTURE)?.values).toMatchObject({ kind: "Start frame", name: "start", required: true });
    expect(refusedAs(await setValues({ documentId: clip.documentId, blockId: opening, structure: INPUT_STRUCTURE, values: { kind: "Mask" } }))).not.toBe("success");
    const document = ok<{ revisionId: string }>(await readDocument(INPUT_STRUCTURE));
    expect(refusedAs(await renameDocument({ documentId: INPUT_STRUCTURE, baseRevisionId: document.revisionId, title: "Attachment" }))).toBe("titleFixed");
    expect(ok<{ statement: string }>(await MIGRATIONS["input-structure"]!()).statement).toBe("");
  }, 30_000);

  it("Given a run that started a document, When it proposes Structure there and Field on a block it added, Then its tools read what it staged, nothing stands until the group is accepted, and then the structure is listed with its field (BO_0344_007)", async () => {
    // A run's group, staged into as the kernel stages a run's work, and read
    // as the shell reads a run's callback: at its pin through the group.
    const group = `node:run-bo0344-${Date.now()}`;
    const head = ok<{ resolvedDataRevision: number }>(
      await query({ statement: "MATCH (d) RETURN GRAPH d ROOT d", roots: [nodeRef(STRUCTURE_STRUCTURE)], purpose: "test" }),
    );
    const run = { id: "arun-bo0344", group, pin: head.resolvedDataRevision };
    const started = ok<{ documentId: string; blockId: string }>(await withBranch(group, () => createDocument({ title: "Video beat" })));
    const field = ok<{ blockId: string }>(
      await withBranch(group, () => insertBlock({ documentId: started.documentId, block: { kind: "text", runs: [{ text: "Duration" }] }, placement: { after: started.blockId } })),
    ).blockId;
    await settle();
    const asRunDoes = <T>(act: () => Promise<T>): Promise<T> => asRun({ pin: run.pin, overlay: group }, act);
    const staging = async (answer: { stage?: readonly { statement: string; parameters: Record<string, unknown>; rationale: string }[] }) => {
      for (const each of answer.stage ?? []) ok(await stage(group, each.statement, each.parameters, each.rationale));
      await settle();
    };

    // Outside the run's group the block it added is not there, as the run's
    // tools read it before, so Field on it was refused.
    const outside = (await readDocumentStructures({ input: { document: started.documentId }, run })).result as { blocks: { blockId: string }[] };
    expect(outside.blocks.map((block) => block.blockId)).not.toContain(field);
    await staging(await asRunDoes(() => proposeStructuresTool({ input: { document: started.documentId, use: [STRUCTURE_STRUCTURE] }, run })));
    const read = (await asRunDoes(() => readDocumentStructures({ input: { document: started.documentId }, run }))).result as {
      structures: { id: string }[];
      blocks: { blockId: string; usable: string[] }[];
    };
    expect(read.structures.map((structure) => structure.id)).toContain(STRUCTURE_STRUCTURE);
    expect(read.blocks.find((block) => block.blockId === field)?.usable).toContain(FIELD_STRUCTURE);
    await staging(await asRunDoes(() => proposeStructuresTool({ input: { document: started.documentId, block: field, use: [FIELD_STRUCTURE] }, run })));
    expect(ok<StructureView[]>(await listStructures()).map((structure) => structure.name)).not.toContain("Video beat");

    // The person accepts the run's proposals: every staged node, each taking
    // its relations with it, then any relation the group still stages.
    const touched = ok<{ touchedNodes: readonly string[]; carryForwardNodes?: readonly string[] }>(await touchedSet(group));
    for (const node of touched.touchedNodes.filter((each) => !(touched.carryForwardNodes ?? []).includes(each))) {
      ok(await decide("accept", group, node, "the run's structure"));
    }
    const left = await touchedSet(group);
    for (const relation of left.outcome === "success" ? left.result.stagedRelations : []) ok(await decide("accept", group, relation.id, "the run's structure"));
    await settle();
    const made = ok<StructureView[]>(await listStructures()).find((structure) => structure.name === "Video beat");
    expect(made?.id).toBe(started.documentId);
    expect(made?.fields.map((each) => each.name)).toEqual(["Duration"]);
  }, 30_000);

  it("Given a run in one document that started a structure, Then the chip names it a structure and Accept all there makes it one (DO_0034_008, DO_0034_004)", async () => {
    const group = `node:run-do0034-${Date.now()}`;
    const here = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Where the run was asked" }));
    await settle();
    const head = ok<{ resolvedDataRevision: number }>(
      await query({ statement: "MATCH (d) RETURN GRAPH d ROOT d", roots: [nodeRef(here.documentId)], purpose: "test" }),
    );
    const run = { id: "arun-do0034", group, pin: head.resolvedDataRevision };
    ok(await withBranch(group, () => insertBlock({ documentId: here.documentId, block: { kind: "text", runs: [{ text: "Made the structure" }] }, placement: { after: here.blockId } })));
    const started = ok<{ documentId: string }>(await withBranch(group, () => createDocument({ title: "Beat" })));
    await settle();
    const proposed = await asRun({ pin: run.pin, overlay: group }, () => proposeStructuresTool({ input: { document: started.documentId, use: [STRUCTURE_STRUCTURE] }, run }));
    for (const each of proposed.stage ?? []) ok(await stage(group, each.statement, each.parameters, each.rationale));
    await settle();

    const read = ok<{ groups: readonly { groupId: string; elsewhere?: readonly { documentId: string; title: string; kind?: string }[] }[] }>(await readDocumentProposals(here.documentId));
    expect(read.groups.find((each) => each.groupId === group)?.elsewhere).toEqual([{ documentId: started.documentId, title: "Beat", kind: "structure" }]);
    const answered = ok<{ notice?: string }>(await answerDocumentGroup({ documentId: here.documentId, groupId: group, answer: "accepted" }));
    expect(answered.notice).toBe("Beat is now a structure.");
    await settle();
    expect(ok<StructureView[]>(await listStructures()).find((structure) => structure.id === started.documentId)?.name).toBe("Beat");
  }, 30_000);
});
