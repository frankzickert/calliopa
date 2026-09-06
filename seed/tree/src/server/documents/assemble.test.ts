import { describe, expect, it } from "vitest";

import type {
  AssembledGraph,
  GraphNodeView,
  GraphRelationView,
} from "../graph/contract";
import { assembleDocument, assembleRetired } from "./assemble";
import { asContent } from "./content";

const DOCUMENT = "00000000-0000-4000-8000-000000000001";

let counter = 0;
const identity = (): string =>
  `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const node = (
  nodeId: string,
  semanticType: string,
  content: Record<string, unknown>,
): GraphNodeView => ({
  nodeId,
  revisionId: identity(),
  semanticType,
  content: asContent(content),
  provenance: { actor: "application" },
  schemaVersion: 1,
  dataRevision: "1",
});

const relation = (
  relationType: string,
  fromNodeId: string,
  nodeId: string,
): GraphRelationView => ({
  relationId: identity(),
  relationType,
  fromNodeId,
  target: { kind: "node", nodeId },
  provenance: { actor: "application" },
  schemaVersion: 1,
  dataRevision: "1",
  validity: {
    status: "active",
    establishedDataRevision: "1",
    closedDataRevision: null,
  },
});

/** A graph holding one document and the blocks it contains, in the given order
 * of declaration rather than of order key, so assembly has something to sort. */
function graphOf(
  blocks: readonly { id: string; type: string; content: Record<string, unknown> }[],
  relationType = "contains",
): AssembledGraph {
  return {
    roots: [DOCUMENT],
    nodes: [
      node(DOCUMENT, "document", { title: "A Story" }),
      ...blocks.map((block) => node(block.id, block.type, block.content)),
    ],
    relations: blocks.map((block) => relation(relationType, DOCUMENT, block.id)),
  };
}

const text = (id: string, order: string, content: Record<string, unknown> = {}) => ({
  id,
  type: "text",
  content: { order, runs: [{ text: id }], ...content },
});

describe("assembling a document", () => {
  it("Given a graph, Then the document's title comes back", () => {
    const document = assembleDocument(graphOf([]), DOCUMENT);
    expect(document?.title).toBe("A Story");
    expect(document?.blocks).toEqual([]);
  });

  it("Given a graph without the document, Then nothing is assembled", () => {
    expect(assembleDocument(graphOf([]), identity())).toBeNull();
  });

  it("Given blocks in any stored order, Then they come back in order-key order", () => {
    const document = assembleDocument(
      graphOf([text("c", "z"), text("a", "0i"), text("b", "i")]),
      DOCUMENT,
    );
    expect(document?.blocks.map((block) => block.blockId)).toEqual(["a", "b", "c"]);
  });

  it("Given a text block, Then its runs and containment come back", () => {
    const document = assembleDocument(graphOf([text("a", "i")]), DOCUMENT);
    const [block] = document?.blocks ?? [];
    expect(block).toMatchObject({
      kind: "text",
      blockId: "a",
      order: "i",
      runs: [{ text: "a" }],
    });
    expect(block?.containmentId).toBeTruthy();
  });

  it("Given a text block with no role, Then it reads as a paragraph", () => {
    const document = assembleDocument(graphOf([text("a", "i")]), DOCUMENT);
    expect(document?.blocks[0]).toMatchObject({ kind: "text", role: "paragraph" });
  });

  it("Given a text block with a role, Then the role comes back", () => {
    const document = assembleDocument(
      graphOf([text("a", "i", { role: "h2" })]),
      DOCUMENT,
    );
    expect(document?.blocks[0]).toMatchObject({ role: "h2" });
  });

  it("Given a divider, Then it comes back as a divider", () => {
    const document = assembleDocument(
      graphOf([{ id: "a", type: "divider", content: { order: "i" } }]),
      DOCUMENT,
    );
    expect(document?.blocks[0]).toMatchObject({ kind: "divider", blockId: "a" });
  });
});

describe("assembling a block type this build does not know", () => {
  it("Given a stored type outside the vocabulary, Then it comes back as unsupported", () => {
    const document = assembleDocument(
      graphOf([{ id: "a", type: "code", content: { order: "i", source: "x" } }]),
      DOCUMENT,
    );
    expect(document?.blocks[0]).toMatchObject({
      kind: "unsupported",
      blockId: "a",
      semanticType: "code",
    });
  });

  it("Given an unsupported block among known ones, Then it keeps its place in the order", () => {
    const document = assembleDocument(
      graphOf([
        text("a", "i"),
        { id: "b", type: "code", content: { order: "j" } },
        text("c", "k"),
      ]),
      DOCUMENT,
    );
    expect(document?.blocks.map((block) => block.blockId)).toEqual(["a", "b", "c"]);
  });

  it("Given an unsupported block with no usable order key, Then it sorts last rather than vanishing", () => {
    const document = assembleDocument(
      graphOf([
        { id: "b", type: "code", content: {} },
        text("a", "i"),
      ]),
      DOCUMENT,
    );
    expect(document?.blocks.map((block) => block.blockId)).toEqual(["a", "b"]);
  });

  it("Given several blocks with no usable order key, Then their order is deterministic", () => {
    const blocks = [
      { id: "y", type: "code", content: {} },
      { id: "x", type: "code", content: {} },
    ];
    const first = assembleDocument(graphOf(blocks), DOCUMENT);
    const second = assembleDocument(graphOf([...blocks].reverse()), DOCUMENT);
    expect(first?.blocks.map((block) => block.blockId)).toEqual(
      second?.blocks.map((block) => block.blockId),
    );
  });

  it("Given content that is not a record, Then the block is still reported", () => {
    const graph = graphOf([]);
    const stray = node("a", "text", {} as Record<string, unknown>);
    const document = assembleDocument(
      {
        ...graph,
        nodes: [...graph.nodes, { ...stray, content: "surprise" }],
        relations: [relation("contains", DOCUMENT, "a")],
      },
      DOCUMENT,
    );
    expect(document?.blocks[0]).toMatchObject({ kind: "unsupported", blockId: "a" });
  });
});

describe("assembling the retired list", () => {
  it("Given retired relations, Then the retired blocks come back in order-key order", () => {
    const retired = assembleRetired(
      graphOf([text("b", "z"), text("a", "i")], "retired"),
      DOCUMENT,
    );
    expect(retired.map((block) => block.blockId)).toEqual(["a", "b"]);
  });

  it("Given contained blocks, Then the retired list leaves them out", () => {
    expect(assembleRetired(graphOf([text("a", "i")]), DOCUMENT)).toEqual([]);
  });

  it("Given retired blocks, Then the document leaves them out", () => {
    const document = assembleDocument(
      graphOf([text("a", "i")], "retired"),
      DOCUMENT,
    );
    expect(document?.blocks).toEqual([]);
  });
});
