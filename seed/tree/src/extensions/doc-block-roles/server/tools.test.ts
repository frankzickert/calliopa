import { describe, expect, it } from "vitest";

import { documentOfInput, proposalOfInput, ToolRefusal } from "./tools";

/** What the tools refuse before they read (`BO_0309_017`). */
const document = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";
const block = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";

describe("read_document_roles", () => {
  it("needs the document as a record id", () => {
    expect(() => documentOfInput({})).toThrow(ToolRefusal);
    expect(() => documentOfInput({ document: "story" })).toThrow(ToolRefusal);
    expect(documentOfInput({ document: ` ${document} ` })).toBe(document);
  });
});

describe("propose_roles", () => {
  it("reads roles to take and clear and values by role, on a block or the document", () => {
    expect(
      proposalOfInput({ document, block, take: ["builtin:keyword"], values: { "builtin:keyword": { d: "2026-10-01" } } }),
    ).toEqual({ documentId: document, blockId: block, take: ["builtin:keyword"], clear: [], values: { "builtin:keyword": { d: "2026-10-01" } } });
    expect(proposalOfInput({ document, clear: [document] })).toEqual({ documentId: document, take: [], clear: [document], values: {} });
  });

  it("refuses what it cannot read, and a call proposing nothing", () => {
    expect(() => proposalOfInput({ document })).toThrow("propose_roles proposes something: take, clear or values");
    expect(() => proposalOfInput({ document, block: "first", take: [document] })).toThrow(ToolRefusal);
    expect(() => proposalOfInput({ document, take: ["Hook"] })).toThrow("propose_roles takes take as a list of role ids");
    expect(() => proposalOfInput({ document, values: { Hook: {} } })).toThrow("propose_roles takes values by role id; Hook is not one");
  });
});
