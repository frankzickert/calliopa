import { describe, expect, it } from "vitest";

import { paragraphsOf, sharedTitle, shareables } from "./shared";

/** What a share hands a document, read as what it takes (BO_0319_050). */
describe("what is shared into a document", () => {
  it("Given a text, Then each stretch between blank lines is a paragraph", () => {
    expect(paragraphsOf("First line\nstill first\n\n  Second  \n\n\n")).toEqual(["First line\nstill first", "Second"]);
  });

  it("Given what was shared, Then a new document is titled by its first line, its address or its file", () => {
    expect(sharedTitle(shareables([{ kind: "text", text: "Notes from the train\nmore" }]))).toBe("Notes from the train");
    expect(sharedTitle(shareables([{ kind: "address", address: "https://example.org/page/" }]))).toBe("example.org/page");
    expect(sharedTitle(shareables([{ kind: "file", name: "IMG_1.jpg", mimeType: "image/jpeg", data: "" }]))).toBe("IMG_1.jpg");
    expect(sharedTitle(shareables([{ kind: "text", text: "x".repeat(100) }]))).toHaveLength(80);
  });

  it("Given an empty text, Then nothing is taken from it", () => {
    expect(shareables([{ kind: "text", text: "  \n " }])).toEqual([]);
  });
});
