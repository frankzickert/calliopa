import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDocument,
  deleteDocument,
  insertBlock,
  readDocument,
} from "~/extensions/documents/server/documents";
import { query, write } from "~/server/ccgw/client";
import { DOCUMENT_TARGET_KIND } from "~/extensions/documents/server/focus";
import { readGraphEnv } from "~/server/ccgw/env";
import { openFocusedWork } from "~/server/focused-work";
import { nodeRef } from "~/server/ccgw/nodes";

import type { DocumentRolesView, RoleView } from "../../lib/roles";
import { MIGRATIONS } from "../../server/migrations";
import {
  builtinsStatement,
  createRole,
  documentsCarrying,
  listRoles,
  proposeRoles,
  readRole,
  reviseRole,
  rolesOf,
  setRole,
  setValues,
} from "../../server/roles";
import { proposeRolesTool, readDocumentRoles, ToolRefusal } from "../../server/tools";

/**
 * Roles over the one graph (`BO_0309_017`, the server side): several roles on
 * one block; offering from above, and never to the block carrying the
 * offering role (`BO_0309_Q1`); values written and read, a
 * same-named field on two roles kept apart, a value of the wrong type refused,
 * a default filled in on taking; the built-ins created once and refused a
 * rename while taking a field; the migration making a document role one of
 * the one type; `propose_roles` staging a proposal and nothing standing until
 * it is accepted; and each refusal by name. And whether blocks may take a
 * role (`calliopa-bootstrap`'s `BO_0332_014`): a role switched to documents
 * alone, the built-ins the document's alone, and an offer never overriding
 * it. Runs under the kernel harness like `documents.test.ts`.
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

describe.skipIf(!configured)("roles over CCGW", () => {
  let documentId = "";
  let first = "";
  let second = "";
  let story: RoleView;
  let hook: RoleView;
  let line: RoleView;
  let blog: RoleView;
  let event: RoleView;

  beforeAll(async () => {
    const created = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "A roled document" }));
    documentId = created.documentId;
    first = created.blockId;
    await settle();
    second = ok<{ blockId: string }>(await insertBlock({ documentId, block: { kind: "text" }, placement: { after: first } })).blockId;
    story = ok<RoleView>(await createRole({ name: "Story", description: "A story with a hook" }));
    hook = ok<RoleView>(await createRole({ name: "Hook", description: "Opens the story" }));
    line = ok<RoleView>(await createRole({ name: "Line" }));
    await settle();
    story = ok<RoleView>(await reviseRole(story.id, { command: "offer", role: hook.id }));
    hook = ok<RoleView>(await reviseRole(hook.id, { command: "offer", role: line.id }));
    blog = ok<RoleView>(await createRole({ name: "Blog post" }));
    event = ok<RoleView>(await createRole({ name: "Event" }));
    await settle();
    blog = ok<RoleView>(await reviseRole(blog.id, { command: "addField", name: "Date", type: "date", required: true }));
    event = ok<RoleView>(await reviseRole(event.id, { command: "addField", name: "Date", type: "date" }));
    await settle();
    blog = ok<RoleView>(await reviseRole(blog.id, { command: "addField", name: "Position", type: "number" }));
    await settle();
    blog = ok<RoleView>(await reviseRole(blog.id, { command: "reviseField", key: blog.fields[1]!.key, default: 1 }));
  });

  afterAll(async () => {
    const document = await readDocument(documentId);
    if (document.outcome === "success") {
      await settle();
      await deleteDocument({ documentId, baseRevisionId: document.result.revisionId });
    }
  });

  it("Given roles offering roles, Then the catalogue lists each with its offers and fields", async () => {
    const listed = ok<RoleView[]>(await listRoles());
    const found = (id: string) => listed.find((role) => role.id === id)!;
    expect(found(story.id).offers).toEqual([hook.id]);
    expect(found(hook.id).offeredBy).toEqual([story.id]);
    expect(found(line.id).offeredBy).toEqual([hook.id]);
    expect(found(blog.id).fields.map((field) => [field.name, field.type, field.required])).toEqual([
      ["Date", "date", true],
      ["Position", "number", false],
    ]);
    expect(found(blog.id).fields[1]!.default).toBe(1);
    expect(refusedAs(await reviseRole(story.id, { command: "offer", role: story.id }))).toBe("offersItself");
    expect(refusedAs(await readRole(NOWHERE))).toBe("unknownRole");
  });

  it("Given a Story document, Then a block takes several roles, one offered from above, and a role is never offered to the block carrying its offering role", async () => {
    const none = ok<DocumentRolesView>(await rolesOf(documentId));
    expect(none.roles).toEqual([]);
    expect(none.blocks.map((block) => block.blockId)).toEqual([first, second]);
    expect(none.blocks[0]!.takeable).not.toContain(hook.id);
    expect(refusedAs(await setRole({ documentId, blockId: first, role: hook.id, taken: true }))).toBe("notOffered");

    const storied = ok<DocumentRolesView>(await setRole({ documentId, role: story.id, taken: true }));
    // Story offers Hook to the blocks under the document, not to the document.
    expect(storied.takeable).not.toContain(hook.id);
    expect(storied.blocks[0]!.takeable).toContain(hook.id);
    // The document's own revision is untouched: a role is a relation.
    expect(ok<{ revisionId: string }>(await readDocument(documentId)).revisionId.startsWith("rev:")).toBe(true);
    await settle();
    ok(await setRole({ documentId, blockId: first, role: hook.id, taken: true }));
    await settle();
    const two = ok<DocumentRolesView>(await setRole({ documentId, blockId: first, role: event.id, taken: true }));
    expect(two.roles.map((role) => role.name)).toEqual(["Story"]);
    expect(two.blocks[0]!.roles.map((role) => role.name).sort()).toEqual(["Event", "Hook"]);
    // Line is offered by Hook: to the blocks under the block carrying Hook,
    // never to that block itself, nor to its sibling.
    expect(two.blocks[0]!.takeable).not.toContain(line.id);
    expect(two.blocks[1]!.takeable).toContain(hook.id);
    expect(two.blocks[1]!.takeable).not.toContain(line.id);
    expect(refusedAs(await setRole({ documentId, blockId: first, role: line.id, taken: true }))).toBe("notOffered");
    expect(refusedAs(await setRole({ documentId, blockId: second, role: line.id, taken: true }))).toBe("notOffered");
    // Taking what already stands writes nothing and answers the same.
    expect(ok<DocumentRolesView>(await setRole({ documentId, blockId: first, role: hook.id, taken: true })).blocks[0]!.roles).toHaveLength(2);
    expect(refusedAs(await setRole({ documentId, blockId: NOWHERE, role: hook.id, taken: true }))).toBe("unknownBlock");
  });

  it("Given Story cleared from the document, Then Hook stays on the block and says it is not offered", async () => {
    await settle();
    const cleared = ok<DocumentRolesView>(await setRole({ documentId, role: story.id, taken: false }));
    expect(cleared.roles).toEqual([]);
    const held = cleared.blocks[0]!.roles.find((role) => role.id === hook.id)!;
    expect(held.offered).toBe(false);
    await settle();
    const again = ok<DocumentRolesView>(await setRole({ documentId, role: story.id, taken: true }));
    expect(again.blocks[0]!.roles.find((role) => role.id === hook.id)!.offered).toBe(true);
  });

  it("Given a block taking two roles with a field of the same name, Then each role's values are kept apart, a default is filled in on taking, and a value of the wrong type is refused", async () => {
    await settle();
    const taken = ok<DocumentRolesView>(await setRole({ documentId, blockId: second, role: blog.id, taken: true }));
    const blogOn = () => taken.blocks[1]!.roles.find((role) => role.id === blog.id)!;
    expect(blogOn().values).toEqual({ [blog.fields[1]!.key]: 1 });
    expect(blogOn().missing).toEqual([blog.fields[0]!.key]);
    await settle();
    ok(await setRole({ documentId, blockId: second, role: event.id, taken: true }));
    await settle();
    ok(await setValues({ documentId, blockId: second, role: blog.id, values: { [blog.fields[0]!.key]: "2026-10-01" } }));
    await settle();
    const both = ok<DocumentRolesView>(await setValues({ documentId, blockId: second, role: event.id, values: { [event.fields[0]!.key]: "2026-12-24" } }));
    const on = (id: string) => both.blocks[1]!.roles.find((role) => role.id === id)!;
    expect(on(blog.id).values).toEqual({ [blog.fields[0]!.key]: "2026-10-01", [blog.fields[1]!.key]: 1 });
    expect(on(blog.id).missing).toEqual([]);
    expect(on(event.id).values).toEqual({ [event.fields[0]!.key]: "2026-12-24" });

    expect(refusedAs(await setValues({ documentId, blockId: second, role: blog.id, values: { [blog.fields[0]!.key]: "1 October" } }))).toBe("valueShape");
    expect(refusedAs(await setValues({ documentId, blockId: second, role: blog.id, values: { nothing: "x" } }))).toBe("unknownField");
    expect(refusedAs(await setValues({ documentId, blockId: first, role: blog.id, values: {} }))).toBe("roleNotTaken");

    // Cleared and taken again, the values come back.
    await settle();
    ok(await setRole({ documentId, blockId: second, role: blog.id, taken: false }));
    await settle();
    const back = ok<DocumentRolesView>(await setRole({ documentId, blockId: second, role: blog.id, taken: true }));
    expect(back.blocks[1]!.roles.find((role) => role.id === blog.id)!.values[blog.fields[0]!.key]).toBe("2026-10-01");
  });

  it("Given the built-ins migration, Then the six built-ins stand once, are refused a rename, and take a field", async () => {
    const first = MIGRATIONS["builtin-roles"]!;
    const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await first());
    if (statement.statement !== "") ok(await write(statement.statement, statement.parameters, "the built-in roles"));
    await settle();
    expect(ok<{ statement: string }>(await builtinsStatement()).statement).toBe("");
    const listed = ok<RoleView[]>(await listRoles());
    expect(listed.slice(0, 6).map((role) => [role.id, role.name, role.builtin])).toEqual([
      ["builtin:keyword", "Keyword", true],
      ["builtin:profile", "Profile", true],
      ["builtin:format", "Format", true],
      ["builtin:source", "Source", true],
      ["builtin:definition", "Definition", true],
      ["builtin:alias", "Alias", true],
    ]);
    expect(refusedAs(await reviseRole("builtin:keyword", { command: "rename", name: "Tag" }))).toBe("builtinRole");
    expect(refusedAs(await reviseRole("builtin:keyword", { command: "retire" }))).toBe("builtinRole");
    const extended = ok<RoleView>(await retried(() => reviseRole("builtin:keyword", { command: "addField", name: "Prompt", type: "longText" })));
    expect(extended.fields.map((field) => field.name)).toContain("Prompt");
    await settle();
    ok(await setRole({ documentId, role: "builtin:keyword", taken: true }));
    expect(ok<readonly { id: string }[]>(await documentsCarrying("builtin:keyword")).map((document) => document.id)).toContain(documentId);
  });

  // BO_0310_030 BO_0310_031. The keywords suite runs beside this one and
  // switches Keyword's Definition, so this one switches only a field of its own.
  it("Given the keyword built-ins migration, Then Keyword offers Definition and Alias for good and sends what is switched on per entry", async () => {
    const built = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["builtin-roles"]!());
    if (built.statement !== "") ok(await write(built.statement, built.parameters, "the built-in roles"));
    await settle();
    const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["keyword-builtins"]!());
    if (statement.statement !== "") ok(await write(statement.statement, statement.parameters, "what Keyword offers and sends"));
    await settle();
    // Set once: an upgrade never resets what a person switched.
    expect(ok<{ statement: string }>(await MIGRATIONS["keyword-builtins"]!()).statement).toBe("");
    const keyword = ok<RoleView>(await readRole("builtin:keyword"));
    expect(keyword.offers).toEqual(expect.arrayContaining(["builtin:definition", "builtin:alias"]));
    expect(Array.isArray(keyword.sendWithPrompt)).toBe(true);
    expect(ok<RoleView>(await readRole("builtin:definition")).offeredBy).toContain("builtin:keyword");
    expect(refusedAs(await reviseRole("builtin:keyword", { command: "unoffer", role: "builtin:alias" }))).toBe("builtinOffer");
    expect(refusedAs(await reviseRole("builtin:definition", { command: "rename", name: "Meaning" }))).toBe("builtinRole");
    let own = keyword.fields.find((field) => field.name === "Sent note")?.key;
    if (own === undefined) {
      const added = ok<RoleView>(await retried(() => reviseRole("builtin:keyword", { command: "addField", name: "Sent note", type: "text" })));
      own = added.fields.find((field) => field.name === "Sent note")!.key;
      await settle();
    }
    const on = ok<RoleView>(await retried(() => reviseRole("builtin:keyword", { command: "sendWithPrompt", entry: own!, on: true })));
    expect(on.sendWithPrompt).toContain(own);
    await settle();
    const off = ok<RoleView>(await retried(() => reviseRole("builtin:keyword", { command: "sendWithPrompt", entry: own!, on: false })));
    expect(off.sendWithPrompt).not.toContain(own);
    expect(refusedAs(await reviseRole(story.id, { command: "sendWithPrompt", entry: own, on: true }))).toBe("sendWithPrompt");
    expect(refusedAs(await reviseRole("builtin:keyword", { command: "sendWithPrompt", entry: "nothing-here", on: true }))).toBe("sendWithPrompt");
    expect(ok<{ statement: string }>(await MIGRATIONS["keyword-builtins"]!()).statement).toBe("");
  });

  // BO_0312_010. The manuscripts suite reads Format beside this one, so this
  // one writes nothing to Format but what the migration writes.
  it("Given the format fields migration, Then Format carries type and schema once, refused a removal or a new type, and a field's key comes from its first name", async () => {
    const built = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["builtin-roles"]!());
    if (built.statement !== "") ok(await write(built.statement, built.parameters, "the built-in roles"));
    await settle();
    const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["format-fields"]!());
    if (statement.statement !== "") ok(await retried(() => write(statement.statement, statement.parameters, "the built-in roles' fields") as never));
    await settle();
    expect(ok<{ statement: string }>(await MIGRATIONS["format-fields"]!()).statement).toBe("");
    const format = ok<RoleView>(await readRole("builtin:format"));
    const type = format.fields.find((field) => field.key === "type");
    expect(type).toMatchObject({ name: "Type", type: "choice", required: true, options: ["text", "table", "image", "video", "PDF", "structured"] });
    expect(format.fields.find((field) => field.key === "schema")).toMatchObject({ name: "Schema", type: "longText", required: false });
    expect(refusedAs(await reviseRole("builtin:format", { command: "removeField", key: "type" }))).toBe("builtinField");
    expect(refusedAs(await reviseRole("builtin:format", { command: "reviseField", key: "type", type: "text" }))).toBe("builtinField");
    expect(refusedAs(await reviseRole("builtin:format", { command: "reviseField", key: "type", options: ["PDF"] }))).toBe("builtinField");
    // A release field whose declaration drifted — written past the refusals,
    // as an older build could — is repaired in place, and nothing else moves.
    const drifted = format.fields.map((field) => (field.key === "schema" ? { ...field, type: "text" } : field));
    ok(await retried(() => write("SET f.fields = $fields", { fNodeId: nodeRef("builtin:format"), fields: drifted }, "a drifted release field") as never));
    await settle();
    const repair = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["format-fields"]!());
    expect(repair.statement).not.toBe("");
    ok(await retried(() => write(repair.statement, repair.parameters, "the built-in roles' fields") as never));
    await settle();
    expect(ok<RoleView>(await readRole("builtin:format")).fields).toEqual(format.fields);
    // A field's key is minted from the name it is first given and kept
    // through a rename, so a reader looks a value up by it.
    const venue = ok<RoleView>(await createRole({ name: "Venue under test" }));
    await settle();
    const added = ok<RoleView>(await reviseRole(venue.id, { command: "addField", name: "Citation style", type: "text" }));
    expect(added.fields.map((field) => field.key)).toEqual(["citationStyle"]);
    await settle();
    const again = ok<RoleView>(await reviseRole(venue.id, { command: "addField", name: "Citation style", type: "text" }));
    expect(again.fields.map((field) => field.key)).toEqual(["citationStyle", "citationStyle2"]);
    await settle();
    const renamed = ok<RoleView>(await reviseRole(venue.id, { command: "reviseField", key: "citationStyle", name: "Style" }));
    expect(renamed.fields[0]).toMatchObject({ key: "citationStyle", name: "Style" });
  });

  it("Given a document role of before, Then the migration makes it a role of the one type, keeping what hung on it", async () => {
    const legacy = crypto.randomUUID();
    const legacyBlock = crypto.randomUUID();
    const other = ok<{ documentId: string }>(await createDocument({ title: "Roled before" })).documentId;
    ok(
      await write(
        [
          `CREATE (r:documentRole {id: $r_id, name: "Essay", status: "established"})`,
          `CREATE (b:blockRole {id: $b_id, name: "Thesis", order: 1, status: "established"})`,
          "RELATE rref -[o:offers]-> bref",
          "RELATE dref -[h:hasDocumentRole]-> rref",
        ].join("; "),
        { r_id: legacy, b_id: legacyBlock, rref: nodeRef(legacy), bref: nodeRef(legacyBlock), dref: nodeRef(other) },
        "a document role of before",
      ),
    );
    await settle();
    const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["one-role-type"]!());
    expect(statement.statement).toContain("RETIRE d0");
    ok(await write(statement.statement, statement.parameters, "one role type"));
    await settle();
    const listed = ok<RoleView[]>(await listRoles());
    const essay = listed.find((role) => role.formerId === legacy)!;
    expect(essay.name).toBe("Essay");
    expect(essay.offers).toEqual([legacyBlock]);
    expect(ok<RoleView>(await readRole(legacy)).id).toBe(essay.id);
    expect(ok<DocumentRolesView>(await rolesOf(other)).roles.map((role) => role.name)).toEqual(["Essay"]);
    const gone = await query({ statement: "MATCH (r:documentRole) RETURN GRAPH r", unbounded: true, purpose: "test" });
    const standing = gone.outcome === "success" ? gone.result.nodes.filter((node) => node.revision.status === "established" && node.id === nodeRef(legacy)) : [];
    expect(standing).toEqual([]);
    expect(ok<{ statement: string }>(await MIGRATIONS["one-role-type"]!()).statement).toBe("");
  });

  it("Given a run proposing a value and a role, Then it is staged and nothing stands until it is accepted", async () => {
    await settle();
    const staged = ok<readonly { statement: string }[]>(
      await proposeRoles({ documentId, blockId: first, take: [blog.id], clear: [event.id], values: { [blog.id]: { [blog.fields[0]!.key]: "2026-11-11" } } }),
    );
    // Take and values fold into one roleFields node: one CREATE, not two.
    expect(staged.map((each) => each.statement.split("; ")[0]!.split(" ")[0])).toEqual(["RELATE", "CLOSE", "CREATE"]);
    expect(staged.filter((each) => each.statement.includes("CREATE (f:roleFields")).length).toBe(1);
    expect(staged.find((each) => each.statement.includes("CREATE (f:roleFields"))!.statement).not.toContain("SET");

    const answer = await proposeRolesTool({ input: { document: documentId, block: first, take: [blog.id] }, run: { id: "arun-test", group: "", pin: 0 } });
    expect(answer.stage).toHaveLength(1);
    expect(ok<DocumentRolesView>(await rolesOf(documentId)).blocks[0]!.roles.map((role) => role.id)).not.toContain(blog.id);

    await expect(proposeRolesTool({ input: { document: documentId, block: second, take: [line.id] }, run: { id: "arun-test", group: "", pin: 0 } })).rejects.toThrow(ToolRefusal);
    await expect(proposeRolesTool({ input: { document: documentId, block: second, values: { [blog.id]: { [blog.fields[0]!.key]: "soon" } } }, run: { id: "arun-test", group: "", pin: 0 } })).rejects.toThrow("Date holds a date as YYYY-MM-DD.");
  });

  it("Given the tool, Then it answers the roles with their values and what each block can take, and refuses a document that is not there", async () => {
    const answer = (await readDocumentRoles({ input: { document: documentId }, run: { id: "arun-test", group: "", pin: 0 } })).result as {
      roles: { name: string }[];
      blocks: { blockId: string; roles: { name: string; fields: { name: string; value: string }[] }[]; takeable: string[] }[];
      note: string;
    };
    expect(answer.roles.map((role) => role.name)).toEqual(expect.arrayContaining(["Story", "Keyword"]));
    const blogOnSecond = answer.blocks[1]!.roles.find((role) => role.name === "Blog post")!;
    expect(blogOnSecond.fields).toEqual([
      expect.objectContaining({ name: "Date", value: "2026-10-01" }),
      expect.objectContaining({ name: "Position", value: "1" }),
    ]);
    expect(answer.blocks[0]!.takeable).toContain(hook.id);
    expect(answer.blocks[0]!.takeable).not.toContain(line.id);
    expect(answer.note).toContain("propose_roles");
    await expect(readDocumentRoles({ input: { document: NOWHERE }, run: { id: "arun-test", group: "", pin: 0 } })).rejects.toThrow(ToolRefusal);
  });
  it("Given a Story block opened as focused work, Then the focused work stands under Story: its header shows it from above and its blocks take Hook, and a Hook block's focused work offers Line", async () => {
    const outline = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "An outline" }));
    await settle();
    ok(await setRole({ documentId: outline.documentId, blockId: outline.blockId, role: story.id, taken: true }));
    const work = ok<{ itemId: string }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: outline.documentId, blockId: outline.blockId })).itemId;
    await settle();
    const under = ok<DocumentRolesView>(await rolesOf(work));
    expect(under.inherited.map((role) => [role.name, role.on, role.document])).toEqual([["Story", outline.blockId, outline.documentId]]);
    expect(under.roles).toEqual([]);
    const child = under.blocks[0]!.blockId;
    expect(under.blocks[0]!.takeable).toContain(hook.id);
    expect(under.blocks[0]!.takeable).not.toContain(line.id);
    const hooked = ok<DocumentRolesView>(await setRole({ documentId: work, blockId: child, role: hook.id, taken: true }));
    expect(hooked.blocks[0]!.roles.find((role) => role.id === hook.id)!.offered).toBe(true);

    // Two levels down: the Hook block's focused work takes Line, offered by Hook.
    const deeper = ok<{ itemId: string }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: work, blockId: child })).itemId;
    await settle();
    const twoDown = ok<DocumentRolesView>(await rolesOf(deeper));
    expect(twoDown.inherited.map((role) => role.name)).toEqual(["Hook", "Story"]);
    expect(twoDown.blocks[0]!.takeable).toContain(line.id);
    ok(await setRole({ documentId: deeper, blockId: twoDown.blocks[0]!.blockId, role: line.id, taken: true }));

    // A document opened from nothing stands under nothing.
    expect(ok<DocumentRolesView>(await rolesOf(outline.documentId)).inherited).toEqual([]);
  });

  it("Given a role switched to documents alone, Then no block takes it while the document does, a block carrying it keeps it and says so, and an offer never lets a block take it", async () => {
    const page = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Document roles" }));
    await settle();
    const other = ok<{ blockId: string }>(await insertBlock({ documentId: page.documentId, block: { kind: "text" }, placement: { after: page.blockId } })).blockId;
    let chapter = ok<RoleView>(await createRole({ name: "Chapter" }));
    expect(chapter.blocks).toBe(true);
    await settle();
    ok(await setRole({ documentId: page.documentId, blockId: page.blockId, role: chapter.id, taken: true }));
    await settle();
    chapter = ok<RoleView>(await reviseRole(chapter.id, { command: "blocks", allowed: false }));
    expect(chapter.blocks).toBe(false);
    const view = ok<DocumentRolesView>(await rolesOf(page.documentId));
    expect(view.takeable).toContain(chapter.id);
    expect(view.blocks.map((block) => block.takeable.includes(chapter.id))).toEqual([false, false]);
    // Kept, and said: nothing is migrated, removed or moved (RO_0003_Q3).
    expect(view.blocks[0]!.roles.find((role) => role.id === chapter.id)).toMatchObject({ notOnBlock: true, blocks: false, offered: true });
    expect(refusedAs(await setRole({ documentId: page.documentId, blockId: other, role: chapter.id, taken: true }))).toBe("blockNotAllowed");
    await expect(
      proposeRolesTool({ input: { document: page.documentId, block: other, take: [chapter.id] }, run: { id: "arun-test", group: "", pin: 0 } }),
    ).rejects.toThrow(/taken by documents alone/u);
    const read = (await readDocumentRoles({ input: { document: page.documentId }, run: { id: "arun-test", group: "", pin: 0 } })).result as {
      blocks: { roles: { id: string; documentOnly?: boolean; notOnBlock?: boolean }[] }[];
    };
    expect(read.blocks[0]!.roles.find((role) => role.id === chapter.id)).toMatchObject({ documentOnly: true, notOnBlock: true });
    ok(await setRole({ documentId: page.documentId, role: chapter.id, taken: true }));
    await settle();
    // Clearing what a block kept stays open.
    expect(ok<DocumentRolesView>(await setRole({ documentId: page.documentId, blockId: page.blockId, role: chapter.id, taken: false })).blocks[0]!.roles).toEqual([]);

    // The four built-ins are the document's alone, as the release says.
    for (const builtin of ["builtin:keyword", "builtin:profile", "builtin:format", "builtin:source"])
      expect(refusedAs(await setRole({ documentId: page.documentId, blockId: other, role: builtin, taken: true }))).toBe("blockNotAllowed");
    expect(refusedAs(await reviseRole("builtin:format", { command: "blocks", allowed: true }))).toBe("builtinBlocks");
    await settle();
    expect(ok<DocumentRolesView>(await setRole({ documentId: page.documentId, role: "builtin:format", taken: true })).roles.map((role) => role.id)).toContain("builtin:format");

    // Scene offers Beat, Beat is the document's alone: a Scene block's focused
    // work takes Beat in its own chip, and none of its blocks does (RO_0003_Q5).
    const scene = ok<RoleView>(await createRole({ name: "Scene" }));
    let beat = ok<RoleView>(await createRole({ name: "Beat" }));
    await settle();
    ok(await reviseRole(scene.id, { command: "offer", role: beat.id }));
    beat = ok<RoleView>(await reviseRole(beat.id, { command: "blocks", allowed: false }));
    ok(await setRole({ documentId: page.documentId, blockId: other, role: scene.id, taken: true }));
    const work = ok<{ itemId: string }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: page.documentId, blockId: other })).itemId;
    await settle();
    const under = ok<DocumentRolesView>(await rolesOf(work));
    expect(under.takeable).toContain(beat.id);
    expect(under.blocks[0]!.takeable).not.toContain(beat.id);
    expect(refusedAs(await setRole({ documentId: work, blockId: under.blocks[0]!.blockId, role: beat.id, taken: true }))).toBe("blockNotAllowed");
    expect(ok<DocumentRolesView>(await setRole({ documentId: work, role: beat.id, taken: true })).roles.map((role) => role.id)).toEqual([beat.id]);
  }, 30_000);
});
