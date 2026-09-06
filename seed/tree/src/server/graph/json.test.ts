import { describe, expect, it } from "vitest";

import { parseMutationRequest, parseReadRequest } from "./json";

const nodeId = "1b0f4d3a-0000-4000-8000-000000000001";

describe("reading a read request off the wire", () => {
  it("Given the JSON form of a read, Then it parses into the typed request", () => {
    const parsed = parseReadRequest({
      roots: [nodeId],
      traverse: [{ direction: "outgoing", depth: 2, relationTypes: ["contains"] }],
      selection: { at: "dataRevision", dataRevision: "12" },
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        roots: [nodeId],
        traverse: [
          { direction: "outgoing", depth: 2, relationTypes: ["contains"] },
        ],
        selection: { at: "dataRevision", dataRevision: "12" },
      },
    });
  });

  it("Given a read with no roots at all, Then it is refused before the graph", () => {
    const parsed = parseReadRequest({ roots: [] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.failures[0].detail).toBe(
        "body.roots is not a non-empty array.",
      );
    }
  });

  it("Given a step with an unknown direction, Then it is refused naming the field", () => {
    const parsed = parseReadRequest({
      roots: [nodeId],
      traverse: [{ direction: "sideways", depth: 1 }],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.failures[0].detail).toContain("body.traverse[0].direction");
    }
  });

  it("Given a body that is not an object, Then it is refused", () => {
    expect(parseReadRequest("everything").ok).toBe(false);
    expect(parseReadRequest(null).ok).toBe(false);
  });
});

describe("reading a mutation off the wire", () => {
  it("Given the JSON form of a mutation, Then every operation parses", () => {
    const parsed = parseMutationRequest({
      operations: [
        { op: "createNode", ref: "note", semanticType: "note", content: { text: "one" } },
        {
          op: "createRelation",
          ref: "link",
          relationType: "references",
          from: { kind: "ref", ref: "note" },
          to: { kind: "node", node: { kind: "id", nodeId } },
        },
        { op: "closeRelation", relationId: nodeId },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.operations).toHaveLength(3);
      expect(parsed.value.operations[0]).toEqual({
        op: "createNode",
        ref: "note",
        semanticType: "note",
        content: { text: "one" },
      });
    }
  });

  it("Given content that is any JSON, Then the schema decides rather than the parser", () => {
    const parsed = parseMutationRequest({
      operations: [
        { op: "createNode", ref: "a", semanticType: "note", content: [1, "two", null] },
      ],
    });
    expect(parsed.ok).toBe(true);
  });

  it("Given an operation with no known verb, Then it is refused naming the field", () => {
    const parsed = parseMutationRequest({ operations: [{ op: "deleteNode" }] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.failures[0].detail).toContain("body.operations[0].op");
    }
  });

  it("Given a revision with no base revision, Then it is refused at the wire", () => {
    const parsed = parseMutationRequest({
      operations: [
        { op: "reviseNode", nodeId, semanticType: "note", content: {} },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.failures[0].detail).toContain("baseRevisionId");
    }
  });

  it("Given no operations, Then the mutation is refused", () => {
    expect(parseMutationRequest({ operations: [] }).ok).toBe(false);
  });
});
