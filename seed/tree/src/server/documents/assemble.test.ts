import { describe, expect, it } from "vitest";

import type { ReadNode, ReadRelation, ReadResult } from "../ccgw/client";
import { assembleDocument, assembleRetired, nodeRef } from "./assemble";

const DOCUMENT = "00000000-0000-4000-8000-000000000001";

let counter = 0;
const identity = (): string =>
  `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

/** A node as CCGW answers it: prefixed id, the type stamped into content. */
const node = (
  id: string,
  semanticType: string,
  content: Record<string, unknown>,
): ReadNode => ({
  id: nodeRef(id),
  revision: {
    id: `rev:${identity()}`,
    content: { _type: semanticType, id, ...content },
    status: "established",
    dataRevision: 1,
    createdAt: 1,
    createdBy: "frank",
  },
});

const relation = (
  type: string,
  fromId: string,
  toId: string,
  status = "active",
): ReadRelation => ({
  id: `rel:${identity()}`,
  type,
  fromNodeId: nodeRef(fromId),
  to: { kind: "node", nodeId: nodeRef(toId) },
  dataRevision: 1,
  createdAt: 1,
  validity: { status },
});

/** A read holding one document and the blocks it contains, in the given order
 * of declaration rather than of order key, so assembly has something to sort. */
function graphOf(
  blocks: readonly { id: string; type: string; content: Record<string, unknown> }[],
  relationType = "CONTAINS",
): ReadResult {
  return {
    roots: [nodeRef(DOCUMENT)],
    nodes: [
      node(DOCUMENT, "document", { title: "A Story" }),
      ...blocks.map((block) => node(block.id, block.type, block.content)),
    ],
    relations: blocks.map((block) => relation(relationType, DOCUMENT, block.id)),
    resolvedDataRevision: 1,
  };
}

const text = (id: string, order: string, content: Record<string, unknown> = {}) => ({
  id,
  type: "text",
  content: { order, runs: [{ text: id }], ...content },
});

describe("assembling a document", () => {
  it("Given a read, Then the document's title and bare id come back", () => {
    const document = assembleDocument(graphOf([]), DOCUMENT);
    expect(document?.title).toBe("A Story");
    expect(document?.documentId).toBe(DOCUMENT);
    expect(document?.blocks).toEqual([]);
  });

  it("Given a read without the document, Then nothing is assembled", () => {
    expect(assembleDocument(graphOf([]), identity())).toBeNull();
  });

  it("Given blocks in any stored order, Then they come back in order-key order", () => {
    const document = assembleDocument(
      graphOf([text("c", "z"), text("a", "0i"), text("b", "i")]),
      DOCUMENT,
    );
    expect(document?.blocks.map((block) => block.blockId)).toEqual(["a", "b", "c"]);
  });

  it("Given a text block, Then its runs and containment come back with a bare id", () => {
    const document = assembleDocument(graphOf([text("a", "i")]), DOCUMENT);
    const [block] = document?.blocks ?? [];
    expect(block).toMatchObject({
      kind: "text",
      blockId: "a",
      order: "i",
      runs: [{ text: "a" }],
    });
    expect(block?.containmentId.startsWith("rel:")).toBe(true);
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

  it("Given a text block with a disposition, Then its standing comes back, and none or an unknown value reads neutral", () => {
    const document = assembleDocument(
      graphOf([
        text("a", "i", { disposition: "pin" }),
        text("b", "u"),
        text("c", "x", { disposition: "banana" }),
      ]),
      DOCUMENT,
    );
    expect(document?.blocks.map((block) => (block.kind === "text" ? block.standing : null))).toEqual(["pin", "neutral", "neutral"]);
  });

  it("Given a divider, Then it comes back as a divider", () => {
    const document = assembleDocument(
      graphOf([{ id: "a", type: "divider", content: { order: "i" } }]),
      DOCUMENT,
    );
    expect(document?.blocks[0]).toMatchObject({ kind: "divider", blockId: "a" });
  });

  it("Given a closed containment, Then the block is no longer in the document", () => {
    const graph = graphOf([text("a", "i")]);
    const closed: ReadResult = {
      ...graph,
      relations: [relation("CONTAINS", DOCUMENT, "a", "closed")],
    };
    expect(assembleDocument(closed, DOCUMENT)?.blocks).toEqual([]);
  });

  it("Given a retired document node, Then nothing is assembled", () => {
    const graph = graphOf([]);
    const [document] = graph.nodes;
    const archived: ReadResult = {
      ...graph,
      nodes: [{ ...(document as ReadNode), revision: { ...(document as ReadNode).revision, status: "archived" } }],
    };
    expect(assembleDocument(archived, DOCUMENT)).toBeNull();
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
