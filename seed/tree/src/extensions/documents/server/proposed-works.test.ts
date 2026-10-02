import { describe, expect, it } from "vitest";

import type { ReadNode } from "~/server/ccgw/client";
import { proposedWorksCited } from "./proposed-works";

/** The sources a proposed sentence carries into its acceptance (`BO_0291_036`, `BO_0313_030`). */
const node = (id: string, content: Record<string, unknown>, status = "candidate"): ReadNode => ({
  id: `node:${id}`,
  revision: { id: `rev:${id}`, content, status, dataRevision: 1, createdAt: 1, createdBy: "run" },
});

describe("proposedWorksCited", () => {
  const group = "node:run-1";
  const nodes = [
    node("blk-s", { _type: "text", _proposal: group, runs: [{ text: "See " }, { text: "", cite: { work: "wrk-new" } }, { text: " and " }, { text: "", cite: { work: "wrk-held" } }, { text: "", cite: { work: "wrk-new" } }] }),
    node("wrk-new", { _type: "document", record: "source", _proposal: group, title: "New" }),
    node("blk-notes", { _type: "text", _proposal: group, runs: [] }),
    node("fld-new", { _type: "roleFields", _proposal: group, role: "builtin:source" }),
    node("wrk-other", { _type: "document", record: "source", _proposal: group, title: "Cited by nothing here" }),
    node("doc-plain", { _type: "document", _proposal: group, title: "No source" }),
    node("wrk-elsewhere", { _type: "document", record: "source", _proposal: "node:run-2", title: "Another group's" }),
    node("blk-t", { _type: "text", _proposal: group, runs: [{ text: "", cite: { work: "wrk-other" } }] }),
  ];

  const edges = [
    { type: "CONTAINS", fromNodeId: "node:wrk-new", toId: "blk-notes" },
    { type: "fieldsOf", fromNodeId: "node:fld-new", toId: "wrk-new" },
    { type: "CONTAINS", fromNodeId: "node:doc-elsewhere", toId: "blk-s" },
  ];

  it("answers the source documents of the same group the item's sentence cites, once each, with their paragraph and Source's values", () => {
    expect(proposedWorksCited(nodes, ["node:blk-s"], group, edges)).toEqual(["node:wrk-new", "node:blk-notes", "node:fld-new"]);
    expect(proposedWorksCited(nodes, ["node:blk-s"], group)).toEqual(["node:wrk-new"]);
    expect(proposedWorksCited(nodes, ["node:blk-t"], group)).toEqual(["node:wrk-other"]);
  });

  it("leaves a source another group proposes, one already held, and a document that is no source, to themselves", () => {
    const citing = [
      node("blk-u", { _type: "text", _proposal: group, runs: [{ text: "", cite: { work: "wrk-elsewhere" } }] }),
      node("blk-v", { _type: "text", _proposal: group, runs: [{ text: "", cite: { work: "doc-plain" } }] }),
    ];
    expect(proposedWorksCited([...nodes, ...citing], ["node:blk-u"], group)).toEqual([]);
    expect(proposedWorksCited([...nodes, ...citing], ["node:blk-v"], group)).toEqual([]);
    expect(proposedWorksCited(nodes, ["node:blk-s"], "node:run-2")).toEqual([]);
  });
});
