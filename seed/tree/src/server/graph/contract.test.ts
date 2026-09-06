import { describe, expect, it } from "vitest";

import {
  MAX_TRAVERSAL_DEPTH,
  type GraphOperation,
  type GraphReadRequest,
  type NonEmpty,
} from "./contract";

const root = "1b0f4d3a-0000-4000-8000-000000000001";

describe("the read contract", () => {
  it("Given a read with no root, Then it does not compile", () => {
    // @ts-expect-error a read names at least one root
    const unrooted: GraphReadRequest = { roots: [] };
    expect(unrooted.roots).toHaveLength(0);
  });

  it("Given a traversal step with no depth, Then it does not compile", () => {
    const stepless = {
      roots: [root] as NonEmpty<string>,
      traverse: [{ direction: "outgoing" as const }],
    };
    // @ts-expect-error every traversal step states how far it goes
    const unbounded: GraphReadRequest = stepless;
    expect(unbounded.traverse).toHaveLength(1);
  });

  it("Given a rooted, bounded read, Then it is the expressible shape", () => {
    const request: GraphReadRequest = {
      roots: [root],
      traverse: [{ direction: "both", depth: 2, relationTypes: ["references"] }],
      selection: { at: "current" },
    };
    expect(request.roots[0]).toBe(root);
    expect(MAX_TRAVERSAL_DEPTH).toBe(16);
  });
});

describe("the mutation contract", () => {
  it("Given a revision that names no base revision, Then it does not compile", () => {
    const blind = {
      op: "reviseNode" as const,
      nodeId: root,
      semanticType: "note",
      content: { text: "second" },
    };
    // @ts-expect-error a revision states the revision it is based on
    const operation: GraphOperation = blind;
    expect(operation.op).toBe("reviseNode");
  });

  it("Given a revision that names its base, Then it is the expressible shape", () => {
    const operation: GraphOperation = {
      op: "reviseNode",
      nodeId: root,
      baseRevisionId: "1b0f4d3a-0000-4000-8000-000000000002",
      semanticType: "note",
      content: { text: "second" },
    };
    expect(operation).toHaveProperty("baseRevisionId");
  });
});
