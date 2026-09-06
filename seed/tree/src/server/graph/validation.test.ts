import { describe, expect, it } from "vitest";

import { testGraphSchema } from "../../../tests/graph-vocabulary";
import type { GraphOperation, GraphReadRequest } from "./contract";
import { validateOperations, validateReadRequest } from "./validation";

const nodeId = "1b0f4d3a-0000-4000-8000-000000000001";
const revisionId = "1b0f4d3a-0000-4000-8000-000000000002";
const rules = (failures: { rule: string }[]) => failures.map((f) => f.rule);

describe("validating a read", () => {
  it("Given a rooted, bounded read, Then nothing is refused", () => {
    const request: GraphReadRequest = {
      roots: [nodeId],
      traverse: [{ direction: "outgoing", depth: 3 }],
      selection: { at: "dataRevision", dataRevision: "42" },
    };
    expect(validateReadRequest(request)).toEqual([]);
  });

  it("Given a root that is not an identifier, Then the read is refused", () => {
    expect(rules(validateReadRequest({ roots: ["the first note"] }))).toEqual([
      "recordId",
    ]);
  });

  it("Given a step that goes nowhere, Then the read is refused", () => {
    expect(
      rules(
        validateReadRequest({
          roots: [nodeId],
          traverse: [{ direction: "both", depth: 0 }],
        }),
      ),
    ).toEqual(["stepDepth"]);
  });

  it("Given more hops than the ceiling allows, Then the read is refused", () => {
    expect(
      rules(
        validateReadRequest({
          roots: [nodeId],
          traverse: [
            { direction: "outgoing", depth: 9 },
            { direction: "incoming", depth: 9 },
          ],
        }),
      ),
    ).toEqual(["traversalDepth"]);
  });

  it("Given a selection that is not a data revision, Then the read is refused", () => {
    expect(
      rules(
        validateReadRequest({
          roots: [nodeId],
          selection: { at: "dataRevision", dataRevision: "yesterday" },
        }),
      ),
    ).toEqual(["dataRevision"]);
  });
});

describe("validating a mutation against the committed schema", () => {
  const validate = (operations: GraphOperation[]) =>
    rules(validateOperations(testGraphSchema, operations));

  it("Given operations naming defined types with acceptable content, Then nothing is refused", () => {
    expect(
      validate([
        { op: "createNode", ref: "note", semanticType: "note", content: { text: "one" } },
        {
          op: "createRelation",
          relationType: "references",
          from: { kind: "ref", ref: "note" },
          to: { kind: "node", node: { kind: "id", nodeId } },
        },
      ]),
    ).toEqual([]);
  });

  it("Given a node type no definition covers, Then the write is refused naming it", () => {
    const failures = validateOperations(testGraphSchema, [
      { op: "createNode", ref: "a", semanticType: "storyboard", content: {} },
    ]);
    expect(failures[0]?.rule).toBe("unknownNodeType");
    expect(failures[0]?.detail).toContain("storyboard");
    expect(failures[0]?.operation).toBe(0);
  });

  it("Given a relation type no definition covers, Then the write is refused naming it", () => {
    const failures = validateOperations(testGraphSchema, [
      {
        op: "createRelation",
        relationType: "inspires",
        from: { kind: "id", nodeId },
        to: { kind: "node", node: { kind: "id", nodeId } },
      },
    ]);
    expect(failures[0]?.rule).toBe("unknownRelationType");
    expect(failures[0]?.detail).toContain("inspires");
  });

  it("Given content the definition rejects, Then the write is refused with its message", () => {
    const failures = validateOperations(testGraphSchema, [
      { op: "createNode", ref: "a", semanticType: "note", content: { body: "one" } },
    ]);
    expect(failures[0]?.rule).toBe("content");
    expect(failures[0]?.detail).toBe("A note carries text.");
  });

  it("Given a reference no earlier operation created, Then the write is refused", () => {
    expect(
      validate([
        {
          op: "createRelation",
          relationType: "references",
          from: { kind: "ref", ref: "missing" },
          to: { kind: "node", node: { kind: "id", nodeId } },
        },
      ]),
    ).toEqual(["unknownRef"]);
  });

  it("Given one reference used twice, Then the write is refused", () => {
    expect(
      validate([
        { op: "createNode", ref: "a", semanticType: "note", content: { text: "one" } },
        { op: "createNode", ref: "a", semanticType: "note", content: { text: "two" } },
      ]),
    ).toEqual(["ref"]);
  });

  it("Given a node revised twice in one mutation, Then the write is refused", () => {
    expect(
      validate([
        { op: "reviseNode", nodeId, baseRevisionId: revisionId, semanticType: "note", content: { text: "one" } },
        { op: "reviseNode", nodeId, baseRevisionId: revisionId, semanticType: "note", content: { text: "two" } },
      ]),
    ).toEqual(["oneRevisionPerNode"]);
  });

  it("Given an identifier that is not one, Then the write is refused", () => {
    expect(
      validate([{ op: "closeRelation", relationId: "the containment" }]),
    ).toEqual(["recordId"]);
  });
});
