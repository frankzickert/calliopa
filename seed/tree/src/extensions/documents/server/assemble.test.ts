import { describe, expect, it } from "vitest";

import type { ReadNode, ReadRelation, ReadResult } from "~/server/ccgw/client";
import { assembleDocument, assembleRetired, labelReferences, numberFiguresAndTables } from "./assemble";
import type { BlockView } from "./assemble";
import { nodeRef } from "~/server/ccgw/nodes";

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

  it("Given a text block with a disposition, Then its standing comes back, and none or an unknown value reads keep", () => {
    const document = assembleDocument(
      graphOf([
        text("a", "i", { disposition: "fixate" }),
        text("b", "u"),
        text("c", "x", { disposition: "banana" }),
      ]),
      DOCUMENT,
    );
    expect(document?.blocks.map((block) => (block.kind === "text" ? block.standing : null))).toEqual(["fixate", "keep", "keep"]);
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

/**
 * What a reference to any block is drawn as (`BO_0300_010`, user decisions
 * 2026-09-25): resolved after the numbering, by what the block is; the
 * referred-to paragraphs numbered as remarks among themselves; nothing for a
 * block outside the reading order or one a paper cannot name.
 */
describe("labelling references", () => {
  const common = (blockId: string, order: string) => ({ blockId, revisionId: `rev-${blockId}`, containmentId: `c-${blockId}`, order });
  const words = (blockId: string, order: string, role: string, text: string, runs: Record<string, unknown>[] = [], standing = "keep"): BlockView =>
    ({ ...common(blockId, order), kind: "text", role, standing, runs: [{ text }, ...runs] }) as unknown as BlockView;
  const blocks: BlockView[] = [
    words("h", "a", "h2", "The Method"),
    words("p1", "b", "paragraph", "Nobody refers to this one."),
    words("p2", "c", "paragraph", "A claim.", [{ text: "", blockRef: "h" }, { text: "", blockRef: "p3" }, { text: "", blockRef: "q" }, { text: "", blockRef: "img" }, { text: "", blockRef: "gone" }, { text: "", blockRef: "abs" }, { text: "", blockRef: "eq" }, { text: "", figureRef: "img2" }]),
    words("p3", "d", "paragraph", "Referred to."),
    words("q", "e", "quote", "A quote referred to."),
    { ...common("img", "f"), kind: "image", objectId: "o", numbered: true, number: 1 } as BlockView,
    { ...common("img2", "f2"), kind: "image", objectId: "o2", numbered: true, number: 2 } as BlockView,
    { ...common("eq", "g"), kind: "equation", tex: "x", standing: "keep" } as unknown as BlockView,
    words("gone", "h", "paragraph", "Discarded.", [], "discarded"),
    words("abs", "i", "abstract", "An abstract."),
  ];

  it("labels a heading by its words, a referred-to paragraph and quote as remarks in order, a numbered figure by its number, and leaves the rest without", () => {
    const { labels, remarks } = labelReferences(blocks, { equations: {}, figures: { img: 1, img2: 2 }, tables: {} });
    expect(labels).toEqual({ h: "The Method", p3: "Remark 1", q: "Remark 2", img: "Figure 1", img2: "Figure 2" });
    expect(remarks).toEqual({ p3: 1, q: 2 });
    // p1 is referred to by nothing, gone is discarded, abs is an abstract, eq is unnumbered.
    expect(labels["p1"]).toBeUndefined();
    expect(labels["gone"]).toBeUndefined();
    expect(labels["abs"]).toBeUndefined();
    expect(labels["eq"]).toBeUndefined();
  });

  it("numbers the code blocks that ask as listings in a sequence of their own, labels a reference to one, and leaves an unnumbered code block without (BO_0303_008)", () => {
    const code = (blockId: string, order: string, rest: Record<string, unknown>): BlockView =>
      ({ blockId, revisionId: `rev-${blockId}`, containmentId: `c-${blockId}`, order, kind: "sourcecode", source: "x", ...rest }) as unknown as BlockView;
    const listed = [
      code("c1", "a", { numbered: true, caption: "The first." }),
      { blockId: "img", revisionId: "r", containmentId: "c", order: "b", kind: "image", objectId: "o", numbered: true } as unknown as BlockView,
      code("c0", "c", {}),
      code("c2", "d", { numbered: true }),
      { blockId: "p", revisionId: "r", containmentId: "c", order: "e", kind: "text", role: "paragraph", runs: [{ text: "", blockRef: "c2" }, { text: "", blockRef: "c0" }] } as unknown as BlockView,
    ];
    const numbered = numberFiguresAndTables(listed);
    expect(numbered.listings).toEqual({ c1: 1, c2: 2 });
    expect(numbered.figures).toEqual({ img: 1 });
    expect(numbered.blocks.map((block: BlockView) => ("number" in block ? block.number : undefined))).toEqual([1, 1, undefined, 2, undefined]);
    const { labels } = labelReferences(numbered.blocks, { equations: {}, figures: numbered.figures, tables: numbered.tables, listings: numbered.listings });
    expect(labels).toEqual({ c2: "Listing 2" });
    expect(labels["c0"]).toBeUndefined();
  });

  it("answers the listing numbers and a listing's caption with the assembled document", () => {
    const document = assembleDocument(
      graphOf([
        { id: "c1", type: "sourcecode", content: { order: "i", source: "x", numbered: true, caption: "The first." } },
        text("a", "j", { runs: [{ text: "See " }, { text: "", blockRef: "c1" }] }),
      ]),
      DOCUMENT,
    );
    expect(document?.listingNumbers).toEqual({ c1: 1 });
    expect(document?.referenceLabels).toEqual({ c1: "Listing 1" });
    const listing = document?.blocks.find((block) => block.blockId === "c1");
    expect(listing).toMatchObject({ kind: "sourcecode", numbered: true, number: 1, caption: "The first." });
  });

  it("answers the labels and the remarks with the assembled document", () => {
    const document = assembleDocument(graphOf([text("a", "i", { runs: [{ text: "See " }, { text: "", blockRef: "b" }] }), text("b", "j")]), DOCUMENT);
    expect(document?.referenceLabels).toEqual({ b: "Remark 1" });
    expect(document?.remarkNumbers).toEqual({ b: 1 });
  });
});
