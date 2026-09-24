import { describe, expect, it } from "vitest";

import type { ReadNode, ReadResult } from "~/server/ccgw/client";
import { assembleDocument, numberCitations, toBlock } from "./assemble";
import { validateText } from "./vocabulary";
import { nodeRef } from "~/server/ccgw/nodes";

/**
 * The numbers a document's citations are drawn as (`BO_0291_013`): first-
 * citation order over the reading order, a work cited twice keeping its
 * number, a discarded block's citation consuming none, and a work not at the
 * pin answered as missing rather than with a stale number. Nothing stores a
 * number and nothing has to keep one true.
 */
const DOCUMENT = "00000000-0000-4000-8000-000000000001";
let counter = 0;
const identity = (): string =>
  `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const node = (id: string, semanticType: string, content: Record<string, unknown>): ReadNode => ({
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
  blocks: readonly { id: string; content: Record<string, unknown> }[],
): ReadResult => ({
  roots: [nodeRef(DOCUMENT)],
  nodes: [
    node(DOCUMENT, "document", { title: "Citations" }),
    ...blocks.map((block) => node(block.id, "text", block.content)),
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

const cite = (work: string, locator?: string) => ({
  text: "",
  cite: { work, ...(locator !== undefined ? { locator } : {}) },
});

const sentence = (id: string, order: string, runs: unknown[], extra: Record<string, unknown> = {}) => ({
  id,
  content: { order, runs, ...extra },
});

describe("numberCitations", () => {
  const blocks = graphOf([
    sentence("blk-a", "i", [{ text: "Thermometry " }, cite("wrk-2", "p. 54"), { text: " builds on " }, cite("wrk-1"), { text: " and again " }, cite("wrk-2")]),
    sentence("blk-b", "m", [{ text: "Cut: " }, cite("wrk-3")], { disposition: "discarded" }),
    sentence("blk-c", "u", [{ text: "Later " }, cite("wrk-3"), cite("wrk-nowhere")]),
  ]);

  it("numbers cited works from one in first-citation order, a work cited twice keeping its number", () => {
    const document = assembleDocument(blocks, DOCUMENT);
    expect(document?.citationNumbers).toEqual({ "wrk-2": 1, "wrk-1": 2, "wrk-3": 3, "wrk-nowhere": 4 });
    expect(document?.missingWorks).toBeUndefined();
  });

  it("gives a discarded block's citation no number and lets it consume none", () => {
    const view = assembleDocument(blocks, DOCUMENT);
    // wrk-3 is first cited in the discarded block and takes its number from
    // the block that reads, blk-c, after wrk-2 and wrk-1.
    expect(view?.citationNumbers?.["wrk-3"]).toBe(3);
    const onlyCut = assembleDocument(
      graphOf([sentence("blk-b", "m", [cite("wrk-3")], { disposition: "discarded" })]),
      DOCUMENT,
    );
    expect(onlyCut?.citationNumbers).toBeUndefined();
  });

  it("answers a work not at the pin as missing, with no number and none consumed", () => {
    const known = new Set(["wrk-1", "wrk-2", "wrk-3"]);
    const document = assembleDocument(blocks, DOCUMENT, { knownWorks: known });
    expect(document?.citationNumbers).toEqual({ "wrk-2": 1, "wrk-1": 2, "wrk-3": 3 });
    expect(document?.missingWorks).toEqual(["wrk-nowhere"]);
  });

  it("is the same function every view answers from", () => {
    const view = assembleDocument(blocks, DOCUMENT);
    const direct = numberCitations(view?.blocks ?? [], new Set(["wrk-1", "wrk-2", "wrk-3"]));
    expect(direct.numbers).toEqual({ "wrk-2": 1, "wrk-1": 2, "wrk-3": 3 });
    expect(direct.missing).toEqual(["wrk-nowhere"]);
  });

  it("reads a citation run back as it was stored", () => {
    const block = toBlock(node("blk-a", "text", { order: "i", runs: [cite("wrk-2", "p. 54")] }), "rel:x");
    expect(block.kind === "text" && block.runs).toEqual([{ text: "", cite: { work: "wrk-2", locator: "p. 54" } }]);
  });
});

describe("validateText with a citation", () => {
  it("keeps a citation and refuses one naming no work or carrying words", () => {
    expect(validateText({ order: "i", runs: [{ text: "see " }, cite("wrk-1", "p. 3")] })).toBeNull();
    expect(validateText({ order: "i", runs: [{ text: "", cite: { locator: "p. 3" } }] })).toBe(
      "Run 0 carries a citation that names no work.",
    );
    expect(validateText({ order: "i", runs: [{ text: "[1]", cite: { work: "wrk-1" } }] })).toBe(
      "Run 0 is a citation carrying text of its own.",
    );
  });
});
