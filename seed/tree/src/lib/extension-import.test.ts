import { describe, expect, it } from "vitest";

import { describeImport, importTitle, nextStep, type ImportSummary } from "./extension-import";

const summary = (over: Partial<ImportSummary>): ImportSummary => ({
  proposal: "node:chg-1",
  id: "demo",
  kind: "new",
  to: "0.1.0",
  category: "individual",
  categoryRewritten: false,
  files: { added: ["a"], changed: [], removed: [] },
  members: {},
  documents: 0,
  documentsSkipped: [],
  migrations: [],
  dependencies: [],
  refusals: [],
  inactive: true,
  rationale: "extension import: demo 0.1.0",
  ...over,
});

describe("an import's summary", () => {
  it("Given a new extension, Then the lines say new, the files, the documents and that it arrives off", () => {
    expect(describeImport(summary({}))).toEqual([
      "New extension demo at version 0.1.0",
      "Files: 1 added, 0 changed, 0 removed",
      "Change documents: 0 staged",
      "Arrives switched off: nothing runs until you switch it on.",
    ]);
    expect(nextStep(summary({}))).toBe("switch-on");
    expect(importTitle(summary({}))).toBe("Import demo 0.1.0");
  });
  it("Given an update with members, migrations, dependencies, skipped documents and a refusal, Then each has its line", () => {
    const lines = describeImport(
      summary({
        kind: "update",
        from: "0.1.0",
        to: "0.2.0",
        inactive: false,
        categoryRewritten: true,
        members: { "ext.skill": 1, "ext.blocktype": 2 },
        documents: 1,
        documentsSkipped: ["Plan"],
        migrations: ["migrations/0001_init.sql"],
        dependencies: [
          { id: "ui.shell", range: ">=1.0.0", held: "1.0.0", present: true, satisfied: true },
          { id: "other", range: "^2.0.0", present: false, satisfied: false },
        ],
        refusals: [{ Path: "src/extensions/demo/x.json", Reason: "derived JSON" }],
      }),
    );
    expect(lines).toEqual([
      "Update of demo from 0.1.0 to 0.2.0",
      "The archive said bundled; it lands as individual, so a release of this instance never ships it.",
      "Files: 1 added, 0 changed, 0 removed",
      "Members: 2 ext.blocktype, 1 ext.skill",
      "Change documents: 1 staged, 1 skipped by title (Plan)",
      "Migration migrations/0001_init.sql: runs when the extension is served",
      "Depends on ui.shell >=1.0.0: the instance holds 1.0.0, in range",
      "Depends on other ^2.0.0: absent from the instance",
      "Refused src/extensions/demo/x.json: derived JSON",
    ]);
    expect(nextStep(summary({ kind: "update", inactive: false }))).toBe("serve");
  });
});
