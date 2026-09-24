import { describe, expect, it } from "vitest";

import type { ReadNode, ReadRelation, ReadResult } from "~/server/ccgw/client";
import { nodeRef } from "~/server/ccgw/nodes";

import { citingDocumentsIn } from "./cited-by";

/**
 * *Cited by* over one read of every document and its text blocks
 * (`BO_0291_023`): which documents cite a work, and which of their blocks.
 */
const node = (id: string, content: Record<string, unknown>, status = "established"): ReadNode => ({
  id: nodeRef(id),
  revision: { id: `rev-${id}`, content, status, dataRevision: 1, createdAt: 1, createdBy: "frank" },
} as ReadNode);

const text = (id: string, order: string, runs: readonly Record<string, unknown>[], disposition?: string) =>
  node(id, { _type: "text", id, order, runs, ...(disposition === undefined ? {} : { disposition }) });

const contains = (from: string, to: string, status = "active"): ReadRelation => ({
  id: `rel-${from}-${to}`,
  type: "CONTAINS",
  fromNodeId: nodeRef(from),
  to: { kind: "node", nodeId: nodeRef(to) },
  dataRevision: 1,
  createdAt: 1,
  validity: { status },
});

const graph: ReadResult = {
  roots: [],
  nodes: [
    node("doc-b", { _type: "document", id: "doc-b", title: "Greenland" }),
    node("doc-a", { _type: "document", id: "doc-a", title: "Antarctica" }),
    node("doc-c", { _type: "document", id: "doc-c", title: "Uncited" }),
    text("t1", "b", [{ text: "Ice sheets thin " }, { text: "", cite: { work: "wrk-1", locator: "p. 4" } }, { text: "." }]),
    text("t2", "a", [{ text: "First, " }, { text: "", cite: { work: "wrk-1" } }, { text: " and " }, { text: "", cite: { work: "wrk-2" } }]),
    text("t3", "a", [{ text: "Set aside " }, { text: "", cite: { work: "wrk-1" } }], "discarded"),
    text("t4", "a", [{ text: "Only the other work " }, { text: "", cite: { work: "wrk-2" } }]),
    text("t5", "a", [{ text: "Taken out " }, { text: "", cite: { work: "wrk-1" } }]),
  ],
  relations: [
    contains("doc-b", "t1"),
    contains("doc-b", "t2"),
    contains("doc-a", "t3"),
    contains("doc-a", "t4"),
    contains("doc-c", "t5", "retired"),
  ],
  resolvedDataRevision: 1,
};

describe("the documents citing a work (BO_0291_023)", () => {
  it("lists each document whose reading order cites it, with its citing blocks in order and their words", () => {
    expect(citingDocumentsIn(graph, "wrk-1")).toEqual([
      {
        documentId: "doc-b",
        title: "Greenland",
        citations: [
          { blockId: "t2", words: "First, and" },
          { blockId: "t1", words: "Ice sheets thin ." },
        ],
      },
    ]);
  });

  it("leaves out a discarded block and one no longer contained, and orders documents by title", () => {
    expect(citingDocumentsIn(graph, "wrk-2").map((document) => document.title)).toEqual(["Antarctica", "Greenland"]);
    expect(citingDocumentsIn(graph, "wrk-3")).toEqual([]);
  });

  it("shortens long words to what the list shows", () => {
    const long: ReadResult = { ...graph, nodes: [...graph.nodes.slice(0, 1), text("t1", "b", [{ text: "word ".repeat(80) }, { text: "", cite: { work: "wrk-9" } }])], relations: [contains("doc-b", "t1")] };
    const words = citingDocumentsIn(long, "wrk-9")[0]!.citations[0]!.words;
    expect(words.length).toBe(160);
    expect(words.endsWith("…")).toBe(true);
  });
});
