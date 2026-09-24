import { describe, expect, it } from "vitest";

import { documentItem } from "./library-item";
import { UNNAMED_DOCUMENT } from "./naming";

/**
 * A document's row in the library: its title, the glyph an extension gives
 * it, and — for a document a run started that nobody has taken — who
 * proposed it, in the words the proposal face uses (`BO_0251_011`), and
 * whether nobody has named it (`DO_0012_003`).
 */
describe("a document's library item", () => {
  it("Given an ordinary document, Then it names and opens it with nothing proposed", () => {
    const item = documentItem({ documentId: "doc-1", title: "Draft" }, undefined);
    expect(item).toEqual({ id: "doc-1", label: "Draft", open: { kind: "document", itemId: "doc-1", title: "Draft" } });
  });

  it("Given a started document, Then it carries its proposer as the runtime and its words", () => {
    const item = documentItem(
      {
        documentId: "doc-2",
        title: "Onboarding checklist",
        proposed: { group: "node:run-1", proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" } },
      },
      { icon: "warning", label: "needs review" },
    );
    expect(item.proposedBy).toEqual({ agent: "claude-code", name: "Claude Code (claude-sonnet-5)" });
    expect(item.glyph).toEqual({ icon: "warning", label: "needs review" });
    expect(item.open).toEqual({ kind: "document", itemId: "doc-2", title: "Onboarding checklist" });
  });

  it("Given a document still carrying the minted name, Then the row says nobody has named it", () => {
    const item = documentItem({ documentId: "doc-new", title: UNNAMED_DOCUMENT }, undefined);
    expect(item.unnamed).toBe(true);
    // The label is still those words: what is listed is named in the listing.
    expect(item.label).toBe(UNNAMED_DOCUMENT);
  });

  it("Given a title somebody wrote, Then the row says nothing about naming", () => {
    expect(documentItem({ documentId: "doc-1", title: "Draft" }, undefined).unnamed).toBeUndefined();
    expect(documentItem({ documentId: "doc-2", title: `${UNNAMED_DOCUMENT} 2` }, undefined).unnamed).toBeUndefined();
  });

  it("Given a document a person's group started, Then its proposer is the person, with no runtime", () => {
    const item = documentItem({ documentId: "doc-3", title: "Mine", proposed: { group: "node:chg-1", proposer: { kind: "person", name: "frank" } } }, undefined);
    expect(item.proposedBy).toEqual({ agent: null, name: "frank" });
  });
});
