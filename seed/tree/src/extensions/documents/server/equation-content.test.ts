import { describe, expect, it } from "vitest";

import type { ReadNode, ReadResult } from "~/server/ccgw/client";
import { blockContentFor } from "./documents";
import { validateEquation } from "./vocabulary";
import { assembleDocument, numberEquations, toBlock, type BlockView } from "./assemble";
import { nodeRef } from "~/server/ccgw/nodes";

/**
 * An equation written into a document and read back (`BO_0290_008`), and the
 * numbers the document's own order gives its equations (`BO_0290_010`,
 * `BO_0290_011`) — which nothing stores and nothing has to keep true.
 */
const DOCUMENT = "00000000-0000-4000-8000-000000000001";
let counter = 0;
const identity = (): string =>
  `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

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

const graphOf = (
  blocks: readonly { id: string; type: string; content: Record<string, unknown> }[],
): ReadResult => ({
  roots: [nodeRef(DOCUMENT)],
  nodes: [
    node(DOCUMENT, "document", { title: "Mathematics" }),
    ...blocks.map((block) => node(block.id, block.type, block.content)),
  ],
  relations: blocks.map((block) => ({
    id: `rel:${identity()}`,
    type: "CONTAINS",
    fromNodeId: nodeRef(DOCUMENT),
    to: { kind: "node" as const, nodeId: nodeRef(block.id) },
    dataRevision: 1,
    createdAt: 1,
    validity: { status: "active" },
  })),
  resolvedDataRevision: 1,
});

const equation = (id: string, order: string, content: Record<string, unknown> = {}) => ({
  id,
  type: "equation",
  content: { order, tex: `x_{${id}}`, ...content },
});

describe("what an equation block stores", () => {
  it("writes its source, and leaves an empty caption and an unasked number out", () => {
    expect(blockContentFor({ kind: "equation", tex: "E = mc^2", caption: " " }, "a0")).toEqual({
      order: "a0",
      tex: "E = mc^2",
    });
  });

  it("writes the caption and the ask for a number when they are given", () => {
    const source = { extension: "documents", authored: "by hand" };
    expect(
      blockContentFor(
        { kind: "equation", tex: "e^{i\\pi} + 1 = 0", caption: " Euler ", numbered: true, source },
        "b0",
      ),
    ).toEqual({
      order: "b0",
      tex: "e^{i\\pi} + 1 = 0",
      caption: "Euler",
      numbered: true,
      source,
    });
  });

  it("never writes a number, because the number is the document's order", () => {
    const content = blockContentFor({ kind: "equation", tex: "x", numbered: true }, "c0");
    expect(content["number"]).toBeUndefined();
  });
});

describe("validating an equation", () => {
  const check = (content: Record<string, unknown>) =>
    validateEquation({ order: "i", tex: "x", ...content });

  it("accepts a source with a caption and an ask", () => {
    expect(check({ caption: "Pythagoras", numbered: true })).toBeNull();
  });

  it("refuses one carrying no source", () => {
    expect(validateEquation({ order: "i" })).toBe("An equation carries the tex it is set from.");
    expect(check({ tex: "   " })).toBe("An equation carries the tex it is set from.");
  });

  it("refuses runs, a caption that is not words and a numbered that is neither", () => {
    expect(check({ runs: [] })).toBe("An equation carries its tex, not runs.");
    expect(check({ caption: 7 })).toBe("An equation's caption is words.");
    expect(check({ numbered: "yes" })).toBe("An equation's numbered is true or false.");
  });

  it("refuses a stored number, which would be the one stale copy of a derived thing", () => {
    expect(check({ numbered: true, number: 1 })).toBe(
      "An equation's number is the document's order and is never stored.",
    );
  });
});

describe("reading an equation back", () => {
  it("answers its source, its caption and its ask", () => {
    const view = toBlock(
      node("blk-e", "equation", { order: "i", tex: "a^2", caption: "Squares", numbered: true }),
      "rel-1",
    );
    expect(view).toMatchObject({ kind: "equation", tex: "a^2", caption: "Squares", numbered: true, standing: "keep" });
  });

  it("reports a stored equation carrying no source rather than drawing an empty box", () => {
    const view = toBlock(node("blk-x", "equation", { order: "i" }), "rel-2");
    expect(view.kind).toBe("unsupported");
  });
});

describe("the numbers the order gives", () => {
  const numbersOf = (blocks: readonly BlockView[]) => numberEquations(blocks).numbers;

  it("numbers the equations that asked, in reading order, and no others", () => {
    const document = assembleDocument(
      graphOf([
        { id: "blk-p", type: "text", content: { order: "b", runs: [{ text: "prose" }] } },
        equation("blk-e1", "c"),
        equation("blk-e2", "d", { numbered: true }),
        equation("blk-e3", "e", { numbered: true }),
      ]),
      DOCUMENT,
    );
    expect(document?.equationNumbers).toEqual({ "blk-e2": 1, "blk-e3": 2 });
    const drawn = document?.blocks.filter((block) => block.kind === "equation") ?? [];
    expect(drawn.map((block) => (block as { number?: number }).number)).toEqual([undefined, 1, 2]);
  });

  it("renumbers when one is inserted above, with nothing written to the others", () => {
    const before = assembleDocument(
      graphOf([equation("blk-e2", "d", { numbered: true }), equation("blk-e3", "e", { numbered: true })]),
      DOCUMENT,
    );
    const after = assembleDocument(
      graphOf([
        equation("blk-new", "c", { numbered: true }),
        equation("blk-e2", "d", { numbered: true }),
        equation("blk-e3", "e", { numbered: true }),
      ]),
      DOCUMENT,
    );
    expect(before?.equationNumbers).toEqual({ "blk-e2": 1, "blk-e3": 2 });
    expect(after?.equationNumbers).toEqual({ "blk-new": 1, "blk-e2": 2, "blk-e3": 3 });
  });

  it("gives a discarded equation no number and lets it consume none", () => {
    const document = assembleDocument(
      graphOf([
        equation("blk-gone", "c", { numbered: true, disposition: "discarded" }),
        equation("blk-e2", "d", { numbered: true }),
      ]),
      DOCUMENT,
    );
    expect(document?.equationNumbers).toEqual({ "blk-e2": 1 });
  });

  it("answers no numbers at all for a document holding none", () => {
    const document = assembleDocument(
      graphOf([{ id: "blk-p", type: "text", content: { order: "b", runs: [{ text: "prose" }] } }]),
      DOCUMENT,
    );
    expect(document?.equationNumbers).toBeUndefined();
  });

  it("resolves a reference to nothing when its equation carries no number", () => {
    const numbers = numbersOf(
      assembleDocument(graphOf([equation("blk-e1", "c")]), DOCUMENT)?.blocks ?? [],
    );
    // The surface draws a reference to blk-e1 as gone rather than as a stale
    // number, because no number resolves for it.
    expect(numbers["blk-e1"]).toBeUndefined();
  });
});
