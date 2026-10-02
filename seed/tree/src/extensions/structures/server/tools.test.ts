import { describe, expect, it } from "vitest";

import { documentOfInput, proposalOfInput, ToolRefusal } from "./tools";

/** What the tools refuse before they read (`BO_0309_017`). */
const document = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";
const block = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";

describe("read_document_structures", () => {
  it("needs the document as a record id", () => {
    expect(() => documentOfInput({})).toThrow(ToolRefusal);
    expect(() => documentOfInput({ document: "story" })).toThrow(ToolRefusal);
    expect(documentOfInput({ document: ` ${document} ` })).toBe(document);
  });
});

describe("propose_structures", () => {
  it("reads structures to take and clear and values by structure, on a block or the document", () => {
    expect(
      proposalOfInput({ document, block, use: ["builtin:keyword"], values: { "builtin:keyword": { d: "2026-10-01" } } }),
    ).toEqual({ documentId: document, blockId: block, take: ["builtin:keyword"], clear: [], values: { "builtin:keyword": { d: "2026-10-01" } } });
    expect(proposalOfInput({ document, clear: [document] })).toEqual({ documentId: document, take: [], clear: [document], values: {} });
  });

  it("refuses what it cannot read, and a call proposing nothing", () => {
    expect(() => proposalOfInput({ document })).toThrow("propose_structures proposes something: use, clear or values");
    expect(() => proposalOfInput({ document, block: "first", use: [document] })).toThrow(ToolRefusal);
    expect(() => proposalOfInput({ document, use: ["Hook"] })).toThrow("propose_structures takes use as a list of structure ids");
    expect(() => proposalOfInput({ document, values: { Hook: {} } })).toThrow("propose_structures takes values by structure id; Hook is not one");
  });
});
