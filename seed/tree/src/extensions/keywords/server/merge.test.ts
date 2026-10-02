import { describe, expect, it } from "vitest";

import type { RoleView } from "~/extensions/doc-block-roles/lib/roles";

import { chosenFrom, mergeStatement, type MergePair } from "./merge";

/** The merge's one script (`BO_0310_021`), pure. */
const role = (id: string, name: string, extra: Partial<RoleView> = {}): RoleView => ({
  id,
  name,
  description: "",
  retired: false,
  builtin: false,
  order: 1,
  fields: [],
  offers: [],
  offeredBy: [],
  blocks: true,
  ...extra,
});

describe("the merge", () => {
  it("reads the chosen roles the settings record kept", () => {
    expect(chosenFrom({ keywordRole: "r-k", definitionRole: { kind: "block", id: "r-d" }, aliasRole: "r-a" })).toEqual({ keywordRole: "r-k", definitionRole: "r-d", aliasRole: "r-a" });
    expect(chosenFrom(null)).toEqual({ keywordRole: null, definitionRole: null, aliasRole: null });
  });

  it("widens the built-in's fields once by name, offers what the chosen role offered, moves each assignment and its values, and retires the chosen role", () => {
    const mine = role("r-k", "Keyword (mine)", {
      fields: [
        { key: "f-domain", name: "Domain", type: "text", required: false },
        { key: "f-note", name: "note", type: "text", required: false },
      ],
      offers: ["r-d", "r-x"],
    });
    const keyword = role("builtin:keyword", "Keyword", { builtin: true, fields: [{ key: "k-note", name: "Note", type: "longText", required: false }], offers: ["builtin:definition"] });
    const definition = role("builtin:definition", "Definition", { builtin: true });
    const pairs: MergePair[] = [
      {
        from: mine,
        into: keyword,
        held: {
          assignments: [
            { subject: "doc-1", relationId: "rel-1" },
            { subject: "doc-2", relationId: "rel-2" },
          ],
          values: [{ nodeId: "node:v-1", subject: "doc-1", values: { "f-domain": "physics", "f-note": "old" }, forRelationId: "for-1" }],
        },
        intoHeld: { assignments: [{ subject: "doc-2", relationId: "rel-9" }], values: [] },
      },
      { from: role("r-d", "Meaning"), into: definition, held: { assignments: [], values: [] }, intoHeld: { assignments: [], values: [] } },
    ];
    const { statement, parameters } = mergeStatement(pairs);
    expect(statement.split("; ")).toEqual([
      "SET m0i.fields = $m0_fields",
      "RELATE m0o1from -[m0o1:offers]-> m0o1to",
      "CLOSE m0h0",
      "RELATE m0h0s -[m0h0n:hasBlockRole]-> m0h0r",
      "CLOSE m0h1",
      "SET m0v0f.role = $m0v0_role, m0v0f.values = $m0v0_values",
      "CLOSE m0v0x",
      "RELATE m0v0ff -[m0v0y:fieldsFor]-> m0v0fr",
      "SET m0r.retired = true",
      "SET m1r.retired = true",
    ]);
    // Note is held by name already; Domain is added under its own key.
    expect((parameters["m0_fields"] as { key: string }[]).map((field) => field.key)).toEqual(["k-note", "f-domain"]);
    // The chosen role's offer of Meaning is the built-ins' own; Example moves.
    expect(parameters["m0o1to"]).toBe("node:r-x");
    // doc-2 takes Keyword already: its old assignment closes, nothing is added.
    expect(parameters["m0h1RelationId"]).toBe("rel-2");
    expect(parameters["m0v0_values"]).toEqual({ "f-domain": "physics", "k-note": "old" });
    expect(parameters["m0v0_role"]).toBe("builtin:keyword");
  });

  it("writes nothing when nothing was chosen", () => {
    expect(mergeStatement([])).toEqual({ statement: "", parameters: {} });
  });
});
