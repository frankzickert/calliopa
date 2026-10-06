import { describe, expect, it } from "vitest";

import { draggedDocument, draggedOverItself } from "./dragged-document";

/** DO_0043_004: a whole document dragged in, told apart from a block. */
describe("a document dragged into a document", () => {
  it("Given a document's tab or library row dragged, Then it is the document", () => {
    expect(draggedDocument({ itemId: "doc-2", kind: "documents:document", source: "tab-strip", operations: ["move", "open-in-tab"] })).toBe("doc-2");
    expect(draggedDocument({ itemId: "doc-3", kind: "documents:document", source: "library", operations: ["move", "open-in-tab"] })).toBe("doc-3");
  });

  it("Given a block dragged out of a view's content, Then it is no document", () => {
    expect(draggedDocument({ itemId: "blk-a", kind: "documents:document", source: "workspace", operations: ["move"] })).toBeNull();
  });

  it("Given a structure out of the library, or a row offering no move, Then it is no document", () => {
    expect(draggedDocument({ itemId: "st-1", kind: "structures:structure", source: "library", operations: ["link"] })).toBeNull();
    expect(draggedDocument({ itemId: "doc-4", kind: "documents:document", source: "library", operations: ["link"] })).toBeNull();
    expect(draggedDocument(null)).toBeNull();
  });

  it("Given a document dragged over its own view, Then it is over itself, And over another it is not", () => {
    const payload = { itemId: "doc-1", kind: "documents:document", source: "tab-strip" };
    expect(draggedOverItself(payload, "doc-1")).toBe(true);
    expect(draggedOverItself(payload, "doc-2")).toBe(false);
    expect(draggedOverItself(payload, null)).toBe(false);
  });
});
