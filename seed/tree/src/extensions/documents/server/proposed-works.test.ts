import { describe, expect, it } from "vitest";

import type { ReadNode } from "~/server/ccgw/client";
import { proposedWorksCited } from "./proposed-works";

/** The works a proposed sentence carries into its acceptance (`BO_0291_036`). */
const node = (id: string, content: Record<string, unknown>, status = "candidate"): ReadNode => ({
  id: `node:${id}`,
  revision: { id: `rev:${id}`, content, status, dataRevision: 1, createdAt: 1, createdBy: "run" },
});

describe("proposedWorksCited", () => {
  const group = "node:run-1";
  const nodes = [
    node("blk-s", { _type: "text", _proposal: group, runs: [{ text: "See " }, { text: "", cite: { work: "wrk-new" } }, { text: " and " }, { text: "", cite: { work: "wrk-held" } }, { text: "", cite: { work: "wrk-new" } }] }),
    node("wrk-new", { _type: "work", _proposal: group, title: "New" }),
    node("wrk-other", { _type: "work", _proposal: group, title: "Cited by nothing here" }),
    node("wrk-elsewhere", { _type: "work", _proposal: "node:run-2", title: "Another group's" }),
    node("blk-t", { _type: "text", _proposal: group, runs: [{ text: "", cite: { work: "wrk-other" } }] }),
  ];

  it("answers the works of the same group the item's sentence cites, once each, and nothing the item does not cite", () => {
    expect(proposedWorksCited(nodes, ["node:blk-s"], group)).toEqual(["node:wrk-new"]);
    expect(proposedWorksCited(nodes, ["node:blk-t"], group)).toEqual(["node:wrk-other"]);
  });

  it("leaves a work another group proposes, and a work already held, to themselves", () => {
    const citing = [node("blk-u", { _type: "text", _proposal: group, runs: [{ text: "", cite: { work: "wrk-elsewhere" } }] })];
    expect(proposedWorksCited([...nodes, ...citing], ["node:blk-u"], group)).toEqual([]);
    expect(proposedWorksCited(nodes, ["node:blk-s"], "node:run-2")).toEqual([]);
  });
});
