import { describe, expect, it } from "vitest";

import { parseFieldChild, parseStructureCommand, withCreate } from "../contributions.server";
import {
  BUILTIN_STRUCTURES,
  CSL_TYPES,
  DEFINITION_STRUCTURE,
  FIELD_STRUCTURE,
  FORMAT_STRUCTURE,
  INPUT_STRUCTURE,
  INSTRUCTION_STRUCTURE,
  KEYWORD_STRUCTURE,
  SOURCE_STRUCTURE,
  STRUCTURE_STRUCTURE,
  ALIAS_STRUCTURE,
  blocksAllowed,
  declaredFor,
  defaultsOf,
  fieldFromBlock,
  fieldOf,
  inOrder,
  isStructureId,
  missingOf,
  releaseFieldsOf,
  structureState,
  takeableFrom,
  valueFor,
  type FieldDeclaration,
  type StructureView,
  type TakenStructure,
} from "../lib/structures";
import { oneStructureTypeStatement, structuresAsDocumentsStatement, type StructureNode } from "./migrations";
import { titleOfNode } from "./structures";

/**
 * The acts a structure's document posts, the rules structures hold to, a field
 * as a block using *Field* declares it, and the migrations' statements
 * (`BO_0309_017`, `RO_0005_006`), each pure.
 */
const id = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";

const structure = (structureId: string, name: string, extra: Partial<StructureView> = {}): StructureView => ({
  id: structureId,
  name,
  description: "",
  retired: false,
  builtin: false,
  order: 1,
  fields: [],
  offers: [],
  offeredBy: [],
  blocks: true,
  text: "",
  ...extra,
});

describe("parseStructureCommand", () => {
  it("reads the acts that stay acts: retire, restore and Keyword's Send with prompt (RO_0005_003)", () => {
    expect(parseStructureCommand({ command: "retire" })).toEqual({ command: { command: "retire" } });
    expect(parseStructureCommand({ command: "restore" })).toEqual({ command: { command: "restore" } });
    expect(parseStructureCommand({ command: "sendWithPrompt", entry: "definition", on: true })).toEqual({
      command: { command: "sendWithPrompt", entry: "definition", on: true },
    });
  });

  it("refuses in words what is written in the structure's document, and what is no act", () => {
    for (const command of ["rename", "describe", "offer", "addField", "reviseField", "removeField", "moveField", "blocks"])
      expect(parseStructureCommand({ command })).toEqual({
        failure: `${command} is not an act on a structure: a structure's name, description, fields and what it allows are written in its document`,
      });
    expect(parseStructureCommand({ command: "sendWithPrompt", entry: "", on: true })).toEqual({ failure: "sendWithPrompt names a field's key or an allowed structure's id" });
    expect(parseStructureCommand({ command: "sendWithPrompt", entry: "d", on: "yes" })).toEqual({ failure: "sendWithPrompt is on or off" });
  });
});

describe("whether blocks may take a structure (BO_0332_010)", () => {
  it("is the release's on a built-in: the four are taken by documents alone, Definition and Alias by blocks", () => {
    for (const builtin of [KEYWORD_STRUCTURE, INSTRUCTION_STRUCTURE, FORMAT_STRUCTURE, SOURCE_STRUCTURE, STRUCTURE_STRUCTURE])
      expect(blocksAllowed(builtin, true)).toBe(false);
    expect(blocksAllowed(DEFINITION_STRUCTURE, false)).toBe(true);
    expect(blocksAllowed(ALIAS_STRUCTURE, undefined)).toBe(true);
    expect(blocksAllowed(FIELD_STRUCTURE, undefined)).toBe(true);
  });

  it("is a person's structure's stored setting, absent meaning allowed (RO_0003_Q1)", () => {
    expect(blocksAllowed(id, undefined)).toBe(true);
    expect(blocksAllowed(id, true)).toBe(true);
    expect(blocksAllowed(id, false)).toBe(false);
  });
});

describe("a structure's id", () => {
  it("is a record id or a built-in's", () => {
    expect(isStructureId(id)).toBe(true);
    expect(isStructureId("builtin:keyword")).toBe(true);
    expect(isStructureId("builtin:Keyword")).toBe(false);
    expect(isStructureId("story")).toBe(false);
  });
});

describe("what a block may take", () => {
  const keyword = structure("builtin:keyword", "Keyword", { builtin: true, order: 0, offers: ["def"] });
  const definition = structure("def", "Definition", { order: 5, offeredBy: ["builtin:keyword"] });
  const story = structure("story", "Story", { order: 2, offers: ["hook"] });
  const hook = structure("hook", "Hook", { order: 3, offeredBy: ["story"], offers: ["line"] });
  const line = structure("line", "Line", { order: 4, offeredBy: ["hook"] });
  const old = structure("old", "Old", { order: 6, retired: true });
  const structures = [line, hook, story, definition, keyword, old];

  it("never offers Structure, which only Structures' + gives a document (RO_0005_Q9)", () => {
    const made = structure(STRUCTURE_STRUCTURE, "Structure", { builtin: true, order: 7, blocks: false });
    expect(takeableFrom([made, story], [], false)).toEqual(["story"]);
  });

  it("is every structure nobody offers, the built-ins first, and never a retired one", () => {
    expect(takeableFrom(structures, [], true)).toEqual(["builtin:keyword", "story"]);
    expect(inOrder(structures).map((each) => each.id)).toEqual(["builtin:keyword", "story", "hook", "line", "def", "old"]);
  });

  it("adds what a structure on the block or above it offers, to any depth", () => {
    expect(takeableFrom(structures, ["story"], true)).toEqual(["builtin:keyword", "story", "hook"]);
    // A block two levels under Story, under a block carrying Hook, takes Line.
    expect(takeableFrom(structures, ["story", "hook"], true)).toEqual(["builtin:keyword", "story", "hook", "line"]);
    expect(takeableFrom(structures, ["builtin:keyword"], true)).toEqual(["builtin:keyword", "story", "def"]);
  });

  it("leaves a structure blocks may not take off every block, offered or not, and keeps it on the document (BO_0332_011)", () => {
    const format = structure("builtin:format", "Format", { builtin: true, order: 1, blocks: false });
    const documentHook = { ...hook, blocks: false };
    const withDocumentStructures = [line, documentHook, story, definition, keyword, format];
    expect(takeableFrom(withDocumentStructures, [], true)).toEqual(["builtin:keyword", "story"]);
    expect(takeableFrom(withDocumentStructures, [], false)).toEqual(["builtin:keyword", "builtin:format", "story"]);
    // Offered by Story above: a block under it never takes a document-only
    // Hook, a document under it — its focused work — does (RO_0003_Q5).
    expect(takeableFrom(withDocumentStructures, ["story"], true)).toEqual(["builtin:keyword", "story"]);
    expect(takeableFrom(withDocumentStructures, ["story"], false)).toEqual(["builtin:keyword", "builtin:format", "story", "hook"]);
  });
});

describe("fields and values", () => {
  const date: FieldDeclaration = { key: "d", name: "Publishing date", type: "date", required: true };
  const position: FieldDeclaration = { key: "p", name: "Position", type: "number", required: false, default: 1 };
  const channel: FieldDeclaration = { key: "c", name: "Channel", type: "choice", required: true, options: ["Blog", "Newsletter"] };

  it("reads a value against its field's type, and says why one is not", () => {
    expect(valueFor(date, "2026-10-01")).toEqual({ value: "2026-10-01" });
    expect(valueFor(date, "1 October")).toEqual({ failure: "Publishing date holds a date as YYYY-MM-DD." });
    expect(valueFor(position, 3)).toEqual({ value: 3 });
    expect(valueFor(position, "3")).toEqual({ failure: "Position holds number." });
    expect(valueFor(channel, "Blog")).toEqual({ value: "Blog" });
    expect(valueFor(channel, "Radio")).toEqual({ failure: "Channel is one of Blog, Newsletter." });
    expect(valueFor({ key: "r", name: "See", type: "reference", required: false }, "not an id")).toEqual({ failure: "See names a document or a block by its id." });
    expect(valueFor(date, null)).toEqual({ value: null });
  });

  it("marks what a required field lacks, and fills defaults when a structure is taken", () => {
    expect(missingOf([date, position, channel], { d: "2026-10-01" })).toEqual(["c"]);
    expect(missingOf([date, channel], { d: "", c: null })).toEqual(["d", "c"]);
    expect(defaultsOf([date, position, channel])).toEqual({ p: 1 });
  });

  it("reads a stored declaration, dropping a default that does not fit it", () => {
    expect(fieldOf({ key: "p", name: "Position", type: "number", required: false, default: 2 })).toEqual({ ...position, default: 2 });
    expect(fieldOf({ key: "p", name: "Position", type: "number", default: "two" })).toEqual({ key: "p", name: "Position", type: "number", required: false });
    expect(fieldOf({ key: "", name: "X", type: "text" })).toBeNull();
    expect(fieldOf({ key: "x", name: "X", type: "colour" })).toBeNull();
  });

  it("says a taken structure that is not offered any more, or retired", () => {
    const taken: TakenStructure = { id, name: "Hook", description: "", retired: false, builtin: false, offered: true, fields: [], values: {}, missing: [], blocks: true };
    expect(structureState(taken)).toBeNull();
    expect(structureState({ ...taken, offered: false })).toBe("not allowed here");
    expect(structureState({ ...taken, retired: true, offered: false })).toBe("retired");
  });
});

describe("the migration to one structure type", () => {
  it("makes each document structure a structure of the one type, moves what hangs on it, and retires it", () => {
    const minted = ["n-1", "n-2"];
    const statement = oneStructureTypeStatement(
      [
        { id: "story", name: "Story", description: "A story", retired: false, offers: [{ relationId: "o1", to: "hook" }], documents: [{ relationId: "h1", from: "doc" }] },
        { id: "old", name: "Old", description: "", retired: true, offers: [], documents: [] },
      ],
      8,
      () => minted.shift() ?? "",
    );
    expect(statement.statement).toBe(
      [
        'CREATE (n0:blockRole {id: $n0_id, name: $n0_name, order: $n0_order, formerId: $n0_former, description: $n0_description, status: "established"})',
        "CLOSE o0_0",
        "RELATE n0ref -[o0_0n:offers]-> o0_0to",
        "CLOSE h0_0",
        "RELATE h0_0doc -[h0_0n:hasBlockRole]-> n0ref",
        "RETIRE d0",
        'CREATE (n1:blockRole {id: $n1_id, name: $n1_name, order: $n1_order, formerId: $n1_former, retired: true, status: "established"})',
        "RETIRE d1",
      ].join("; "),
    );
    expect(statement.parameters).toMatchObject({
      n0_id: "n-1",
      n0_name: "Story",
      n0_order: 8,
      n0_former: "story",
      n0_description: "A story",
      n0ref: "node:n-1",
      o0_0RelationId: "o1",
      o0_0From: "node:story",
      o0_0to: "node:hook",
      h0_0RelationId: "h1",
      h0_0From: "node:doc",
      h0_0doc: "node:doc",
      d0NodeId: "node:story",
      n1_order: 9,
      d1NodeId: "node:old",
    });
  });

  it("says nothing when no document structure stands", () => {
    expect(oneStructureTypeStatement([], 1)).toEqual({ statement: "", parameters: {} });
  });
});

/** Source's release fields and the row's create action (BO_0313_010, BO_0313_011). */
describe("Source", () => {
  it("declares the CSL record as its release fields, Kind a required choice of every CSL type", () => {
    const fields = releaseFieldsOf(SOURCE_STRUCTURE);
    expect(fields.map((field) => field.key)).toEqual([
      "kind", "authors", "editors", "issued", "container", "volume", "issue", "pages", "publisher",
      "place", "doi", "isbn", "url", "accessed", "abstract", "tags", "file", "fetched",
    ]);
    const kind = fields[0]!;
    expect(kind).toMatchObject({ name: "Kind", type: "choice", required: true });
    expect(kind.options).toEqual(CSL_TYPES);
    expect(fields.find((field) => field.key === "file")?.type).toBe("file");
    expect(fields.filter((field) => field.type === "longText").map((field) => field.key)).toEqual(["authors", "editors", "abstract"]);
    expect(fields.every((field) => fieldOf(field) !== null)).toBe(true);
  });

  it("leaves a structure without release fields with none, and Format keeps its own", () => {
    expect(releaseFieldsOf(KEYWORD_STRUCTURE)).toEqual([]);
    expect(releaseFieldsOf(FORMAT_STRUCTURE).map((field) => field.key)).toEqual(["type", "schema", "provider", "model", "ratio", "quality"]);
    expect(BUILTIN_STRUCTURES.find((one) => one.id === SOURCE_STRUCTURE)).toBeDefined();
  });

  it("carries Add source on the Source row while its kind is registered, and nothing on any other row", () => {
    const source = structure(SOURCE_STRUCTURE, "Source", { builtin: true });
    expect(withCreate(source, (kind) => kind === "bibliography:new-source").create).toEqual({ kind: "bibliography:new-source", label: "Add source" });
    expect(withCreate(source, () => false).create).toBeUndefined();
    expect(withCreate(structure(KEYWORD_STRUCTURE, "Keyword", { builtin: true }), () => true).create).toBeUndefined();
    expect(withCreate(structure(id, "Source"), () => true).create).toBeUndefined();
  });
});

// The title a reference value is shown by in the header's values line
// (`DO_0030_005`, `referenceTitles`): a document by its title, a block by its
// first words, cut.
describe("titleOfNode", () => {
  it("Given a document, Then its title", () => {
    expect(titleOfNode({ title: "The essay" }, true)).toBe("The essay");
  });

  it("Given a block, Then its words, spaces folded, cut at sixty", () => {
    expect(titleOfNode({ runs: [{ text: "Quantum  computing\nis " }, { text: "loud." }] }, false)).toBe("Quantum computing is loud.");
    const cut = titleOfNode({ runs: [{ text: "word ".repeat(30) }] }, false);
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("Given a node with no words, Then nothing", () => {
    expect(titleOfNode({}, false)).toBe("");
    expect(titleOfNode({}, true)).toBe("");
  });
});

/** A field as a block using Field declares it (RO_0005). */
describe("a field as a block using Field", () => {
  it("reads the block's words as the name, Field's values as the rest, and its key as stored or the block's id", () => {
    expect(fieldFromBlock("blk", "  Citation style ", { key: "citationStyle", type: "Choice", required: true, options: "APA\n\nMLA\nAPA" })).toEqual({
      key: "citationStyle",
      name: "Citation style",
      type: "choice",
      required: true,
      blockId: "blk",
      options: ["APA", "MLA"],
    });
    expect(fieldFromBlock("blk", "", {})).toEqual({ key: "blk", name: "Untitled field", type: "text", required: false, blockId: "blk" });
    expect(fieldFromBlock("b", "Allowed", { type: "Reference", many: true, carrying: FORMAT_STRUCTURE })).toMatchObject({ type: "reference", many: true, carrying: FORMAT_STRUCTURE });
    expect(fieldFromBlock("b", "Model", { type: "Text", suggest: "media:model", suggestions: "a\nb" })).toMatchObject({ suggest: "media:model", suggestions: ["a", "b"] });
  });

  it("reads a default as the type Type names, and drops one that does not fit (RO_0005_Q4)", () => {
    expect(fieldFromBlock("b", "Pages", { type: "Number", default: "12" }).default).toBe(12);
    expect(fieldFromBlock("b", "Pages", { type: "Number", default: 12 }).default).toBe(12);
    expect(fieldFromBlock("b", "Done", { type: "True/false", default: "true" }).default).toBe(true);
    expect(fieldFromBlock("b", "Style", { type: "Choice", options: "APA", default: "MLA" }).default).toBeUndefined();
    expect(fieldFromBlock("b", "See", { type: "Reference", default: "x" }).default).toBeUndefined();
  });

  it("declares Field's Default as the type the block's Type names, and leaves it out for a file or a reference", () => {
    const fields = releaseFieldsOf(FIELD_STRUCTURE);
    const defaultOf = (values: Record<string, unknown>) => declaredFor(FIELD_STRUCTURE, fields, values as never).find((field) => field.key === "default");
    expect(defaultOf({ type: "Date" })).toMatchObject({ type: "date" });
    expect(defaultOf({ type: "Choice", options: "A\nB" })).toMatchObject({ type: "choice", options: ["A", "B"] });
    expect(defaultOf({ type: "File" })).toBeUndefined();
    expect(defaultOf({ type: "Reference" })).toBeUndefined();
    expect(declaredFor(SOURCE_STRUCTURE, releaseFieldsOf(SOURCE_STRUCTURE), { type: "Date" })).toBe(releaseFieldsOf(SOURCE_STRUCTURE));
  });

  it("holds several references as a list of record ids", () => {
    const allows = releaseFieldsOf(STRUCTURE_STRUCTURE).find((field) => field.key === "allows")!;
    expect(valueFor(allows, [id, id])).toEqual({ value: [id] });
    expect(valueFor(allows, id)).toEqual({ failure: "Allows names documents or blocks by their ids." });
    expect(valueFor(allows, ["story"])).toEqual({ failure: "Allows names documents or blocks by their ids." });
  });
});

/** The migration making every structure a document (RO_0005_002). */
describe("the migration to structures as documents", () => {
  const essay: StructureNode = {
    id: "essay",
    name: "Essay",
    description: "A long argument",
    retired: false,
    order: 3,
    blocks: false,
    fields: [{ key: "pages", name: "Pages", type: "number", required: true, default: 10 }],
    offers: ["thesis"],
    uses: [{ relationId: "h1", subject: "doc" }],
    values: [{ nodeId: "vals", fieldsFor: "ff1" }],
  };
  const thesis: StructureNode = { id: "thesis", name: "Thesis", description: "", retired: true, order: 4, blocks: true, fields: [], offers: [], uses: [], values: [] };
  const everyBuiltin = { ids: new Set(BUILTIN_STRUCTURES.map((release) => release.id as string)), formerIds: new Set<string>() };

  it("makes each node a document using Structure, its fields blocks using Field by key, and moves what hung on it", () => {
    let n = 0;
    const statement = structuresAsDocumentsStatement([essay, thesis], everyBuiltin, () => `m-${(n += 1)}`);
    const lines = statement.statement.split("; ");
    // Every document stands before anything relates to it.
    expect(lines.slice(0, 2)).toEqual([
      'CREATE (d1:document {id: $d1_id, title: $d1_title, status: "established"})',
      'CREATE (d6:document {id: $d6_id, title: $d6_title, status: "established"})',
    ]);
    expect(statement.parameters).toMatchObject({ d1_id: "m-1", d1_title: "Essay", d6_id: "m-2", d6_title: "Thesis" });
    const values = Object.entries(statement.parameters).filter(([key]) => key.endsWith("_values")).map(([, value]) => value);
    expect(values).toEqual([
      { key: "pages", type: "Number", required: true, default: "10" },
      { order: 3, blocks: false, allows: ["m-2"], formerIds: ["essay"] },
      { order: 4, blocks: true, retired: true, formerIds: ["thesis"] },
    ]);
    expect(lines.slice(-5)).toEqual(["CLOSE u9c", "RELATE u9s -[u9n:hasBlockRole]-> u9t", "SET v10.role = $v10_role", "CLOSE v10c", "RELATE v10f -[v10n:fieldsFor]-> v10t"]);
    expect(statement.parameters).toMatchObject({ u9cRelationId: "h1", u9cFrom: "node:doc", u9t: "node:m-1", v10_role: "m-1", v10cRelationId: "ff1", v10NodeId: "node:vals" });
  });

  it("makes every built-in the instance lacks from the release, Structure using itself, and answers nothing once all stand", () => {
    const statement = structuresAsDocumentsStatement([], { ids: new Set(), formerIds: new Set() }, () => crypto.randomUUID());
    for (const release of BUILTIN_STRUCTURES) expect(Object.values(statement.parameters)).toContain(release.id);
    expect(Object.values(statement.parameters)).toContainEqual(expect.objectContaining({ allows: [FIELD_STRUCTURE] }));
    expect(structuresAsDocumentsStatement([], everyBuiltin)).toEqual({ statement: "", parameters: {} });
    expect(structuresAsDocumentsStatement([essay], { ...everyBuiltin, formerIds: new Set(["essay"]) }, () => "x").statement).not.toContain("CREATE (d");
  });

  // ME_0002_002: the input-structure migration makes the one built-in an
  // instance holding the others lacks, and nothing more.
  it("Given an instance holding every built-in but Input, Then only Input's document is made, with its three fields", () => {
    const standing = { ids: new Set([...everyBuiltin.ids].filter((one) => one !== INPUT_STRUCTURE)), formerIds: new Set<string>() };
    let n = 0;
    const statement = structuresAsDocumentsStatement([], standing, () => `m-${(n += 1)}`);
    expect(statement.statement.match(/CREATE \(d\d+:document/gu)).toHaveLength(1);
    expect(statement.parameters).toMatchObject({ d1_id: INPUT_STRUCTURE, d1_title: "Input" });
    const fields = Object.entries(statement.parameters).filter(([key]) => key.endsWith("_values")).map(([, value]) => value);
    expect(fields.slice(0, 3)).toEqual([
      { key: "kind", type: "Choice", required: true, options: "Start frame\nEnd frame\nReference image\nReference video\nReference audio" },
      { key: "name", type: "Text", required: true, suggest: "media:inputName" },
      { key: "required", type: "True/false" },
    ]);
  });
});


// A block put into a field names the field and the block (`calliopa-bootstrap`'s
// `BO_0349_020`); a body naming no child stores values as before.
describe("parseFieldChild", () => {
  it("Given no child, Then the body stores values", () => {
    expect(parseFieldChild({ values: { hook: "words" } })).toBeNull();
  });

  it("Given a field and a child, Then the block is put in, unless put is false", () => {
    expect(parseFieldChild({ field: "hook", child: id })).toEqual({ field: "hook", child: id, put: true });
    expect(parseFieldChild({ field: "hook", child: id, put: false })).toEqual({ field: "hook", child: id, put: false });
  });

  it("Given a child with no field, a child that is not an id, or put that is not true or false, Then why not", () => {
    expect(parseFieldChild({ child: id })).toEqual({ failure: "a block is put into a field named by its key" });
    expect(parseFieldChild({ field: "hook", child: "b1" })).toEqual({ failure: "a block put into a field is named by its id" });
    expect(parseFieldChild({ field: "hook", child: id, put: "no" })).toEqual({ failure: "put is true or false" });
  });
});
