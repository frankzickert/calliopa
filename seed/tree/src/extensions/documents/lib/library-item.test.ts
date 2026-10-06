import { describe, expect, it } from "vitest";

import { DOCUMENTS_FILTER, documentItem } from "./library-item";
import { applyFilter, filterChoiceOf } from "~/lib/library-filter";
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
    expect(item).toEqual({
      id: "doc-1",
      label: "Draft",
      facets: { kind: { value: "document", label: "Document" } },
      open: { kind: "document", itemId: "doc-1", title: "Draft" },
    });
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

  it("Given a recorded document, Then its kind is the record, named by its word", () => {
    const item = documentItem({ documentId: "src-1", title: "Kucsko 2013", record: "source" }, undefined);
    expect(item.facets?.["kind"]).toEqual({ value: "source", label: "Source" });
  });

  it("Given a started or unnamed document, Then it carries the value the filter hides it by", () => {
    const started = documentItem(
      { documentId: "doc-2", title: "Plan", proposed: { group: "node:run-1", proposer: { kind: "agent", agent: "hermes", executedBy: "hermes" } } },
      undefined,
    );
    expect(started.facets?.["started"]).toEqual({ value: "started", label: "Started by an agent", icon: "robot" });
    expect(started.facets?.["unnamed"]).toBeUndefined();
    const unnamed = documentItem({ documentId: "doc-3", title: UNNAMED_DOCUMENT }, undefined);
    expect(unnamed.facets?.["unnamed"]).toEqual({ value: "unnamed", label: "Unnamed" });
    expect(unnamed.facets?.["started"]).toBeUndefined();
  });

  it("Given its times, Then it orders by them; without them it carries no order numbers", () => {
    const item = documentItem({ documentId: "doc-1", title: "Draft", changedAt: 300, createdAt: 100 }, undefined);
    expect(item.orderKeys).toEqual({ changed: 300, created: 100 });
    expect(documentItem({ documentId: "doc-1", title: "Draft" }, undefined).orderKeys).toBeUndefined();
  });

  it("Given the section's filter with nothing stored, Then every document lists by title", () => {
    const items = [
      documentItem({ documentId: "b", title: "beta", changedAt: 1, createdAt: 1 }, undefined),
      documentItem({ documentId: "a", title: "Alpha", record: "source", changedAt: 9, createdAt: 2 }, undefined),
      documentItem({ documentId: "c", title: UNNAMED_DOCUMENT, changedAt: 5, createdAt: 3 }, undefined),
    ];
    const listed = (stored: readonly string[] | null) =>
      applyFilter(DOCUMENTS_FILTER, filterChoiceOf(DOCUMENTS_FILTER, stored), "", items).map((item) => item.id);
    expect(listed(null)).toEqual(["a", "b", "c"]);
    expect(listed(["order:changed"])).toEqual(["a", "c", "b"]);
    expect(listed(["order:created"])).toEqual(["c", "a", "b"]);
    expect(listed(["kind:source", "unnamed:unnamed"])).toEqual(["b"]);
  });

  it("Given a document an extension names a structure, Then it carries the value the filter hides it by; a plain one carries none (DO_0042_003)", () => {
    const structure = documentItem({ documentId: "story", title: "Story", named: "structure" }, undefined);
    expect(structure.facets?.["structure"]).toEqual({ value: "structure", label: "Structures" });
    expect(documentItem({ documentId: "doc-1", title: "Draft" }, undefined).facets?.["structure"]).toBeUndefined();
    expect(documentItem({ documentId: "doc-1", title: "Draft", named: "manuscript" }, undefined).facets?.["structure"]).toBeUndefined();
  });

  it("Given structure documents, Then the section hides them until shown, also for a choice stored before (DO_0042_003)", () => {
    const items = [
      documentItem({ documentId: "a", title: "Alpha" }, undefined),
      documentItem({ documentId: "s", title: "Story", named: "structure" }, undefined),
      documentItem({ documentId: "u", title: "Using Story" }, undefined),
    ];
    const listed = (stored: readonly string[] | null) =>
      applyFilter(DOCUMENTS_FILTER, filterChoiceOf(DOCUMENTS_FILTER, stored), "", items).map((item) => item.id);
    expect(listed(null)).toEqual(["a", "u"]);
    expect(listed(["kind:source", "order:title"])).toEqual(["a", "u"]);
    expect(listed(["shown:structure:structure", "order:title"])).toEqual(["a", "s", "u"]);
  });
});
