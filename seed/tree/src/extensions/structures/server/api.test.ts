import { describe, expect, it } from "vitest";

import { parseStructureCommand, withCreate } from "../contributions.server";
import {
  BUILTIN_STRUCTURES,
  CSL_TYPES,
  blocksAllowed,
  defaultsOf,
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
import { oneStructureTypeStatement } from "./migrations";
import { titleOfNode } from "./structures";

/**
 * The acts the structure page posts, the rules the one structure type holds to, and the
 * migration's statement (`BO_0309_017`), each pure.
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
  ...extra,
});

describe("parseStructureCommand", () => {
  it("reads each act with what it carries", () => {
    expect(parseStructureCommand({ command: "rename", name: "Story" })).toEqual({ command: { command: "rename", name: "Story" } });
    expect(parseStructureCommand({ command: "describe", description: "A story" })).toEqual({ command: { command: "describe", description: "A story" } });
    expect(parseStructureCommand({ command: "retire" })).toEqual({ command: { command: "retire" } });
    expect(parseStructureCommand({ command: "offer", structure: id })).toEqual({ command: { command: "offer", structure: id } });
    expect(parseStructureCommand({ command: "unoffer", structure: "builtin:keyword" })).toEqual({ command: { command: "unoffer", structure: "builtin:keyword" } });
    expect(parseStructureCommand({ command: "addField", name: "Channel", type: "choice", options: ["Blog"], required: true })).toEqual({
      command: { command: "addField", name: "Channel", type: "choice", required: true, options: ["Blog"] },
    });
    expect(parseStructureCommand({ command: "reviseField", key: "k", default: null })).toEqual({ command: { command: "reviseField", key: "k", default: null } });
    expect(parseStructureCommand({ command: "removeField", key: "k" })).toEqual({ command: { command: "removeField", key: "k" } });
    expect(parseStructureCommand({ command: "moveField", key: "k", by: -1 })).toEqual({ command: { command: "moveField", key: "k", by: -1 } });
  });

  it("refuses what is not an act, in words", () => {
    expect(parseStructureCommand({ command: "delete" })).toEqual({ failure: "delete is not an act on a structure" });
    expect(parseStructureCommand({ command: "offer", structure: "story" })).toEqual({ failure: "offer names the structure by its id" });
    expect(parseStructureCommand({ command: "addField", name: "X", type: "colour" })).toHaveProperty("failure");
    expect(parseStructureCommand({ command: "addField", name: "X", type: "choice", options: "a,b" })).toEqual({ failure: "a choice's options are a list of words" });
    expect(parseStructureCommand({ command: "reviseField", key: "k", required: "yes" })).toEqual({ failure: "required is true or false" });
    expect(parseStructureCommand({ command: "moveField", key: "k", by: 2 })).toEqual({ failure: "moveField moves by -1 or 1" });
    expect(parseStructureCommand({ command: "blocks", allowed: "no" })).toEqual({ failure: "blocks is allowed: true or false" });
  });

  it("reads whether blocks may take the structure (BO_0332_010)", () => {
    expect(parseStructureCommand({ command: "blocks", allowed: false })).toEqual({ command: { command: "blocks", allowed: false } });
    expect(parseStructureCommand({ command: "blocks", allowed: true })).toEqual({ command: { command: "blocks", allowed: true } });
  });
});

describe("whether blocks may take a structure (BO_0332_010)", () => {
  it("is the release's on a built-in: the four are taken by documents alone, Definition and Alias by blocks", () => {
    for (const builtin of ["builtin:keyword", "builtin:profile", "builtin:format", "builtin:source"])
      expect(blocksAllowed(builtin, true)).toBe(false);
    expect(blocksAllowed("builtin:definition", false)).toBe(true);
    expect(blocksAllowed("builtin:alias", undefined)).toBe(true);
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
    const fields = releaseFieldsOf("builtin:source");
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
    expect(releaseFieldsOf("builtin:keyword")).toEqual([]);
    expect(releaseFieldsOf("builtin:format").map((field) => field.key)).toEqual(["type", "schema", "provider", "model", "ratio", "quality"]);
    expect(BUILTIN_STRUCTURES.find((one) => one.id === "builtin:source")).toBeDefined();
  });

  it("carries Add source on the Source row while its kind is registered, and nothing on any other row", () => {
    const source = structure("builtin:source", "Source", { builtin: true });
    expect(withCreate(source, (kind) => kind === "bibliography:new-source").create).toEqual({ kind: "bibliography:new-source", label: "Add source" });
    expect(withCreate(source, () => false).create).toBeUndefined();
    expect(withCreate(structure("builtin:keyword", "Keyword", { builtin: true }), () => true).create).toBeUndefined();
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
