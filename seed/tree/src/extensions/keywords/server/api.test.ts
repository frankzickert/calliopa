import { describe, expect, it } from "vitest";

import { settingsFrom } from "../contributions.server";
import { NO_SETTINGS } from "../lib/keywords";
import { settingsOf } from "./settings";

/** The settings as a PUT carries them and as the kernel stores them (`BO_0301_018`). */
const role = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";
const block = "1a2b3c4d-1111-4aaa-8bbb-000000000001";

describe("the settings a choice posts", () => {
  it("takes one field at a time over what stands, and null or the empty value for none", () => {
    const withKeyword = settingsFrom({ keywordRole: role }, NO_SETTINGS);
    expect(withKeyword).toEqual({ keywordRole: role, definitionRole: null, aliasRole: null });
    expect(settingsFrom({ aliasRole: block }, withKeyword)).toEqual({ keywordRole: role, definitionRole: null, aliasRole: block });
    expect(settingsFrom({ keywordRole: "" }, withKeyword)).toEqual(NO_SETTINGS);
    expect(settingsFrom({ keywordRole: null }, withKeyword)).toEqual(NO_SETTINGS);
  });

  it("reads the definition role as block:<id> or document:<id>, or as the stored shape", () => {
    expect(settingsFrom({ definitionRole: `block:${block}` }, NO_SETTINGS).definitionRole).toEqual({ kind: "block", id: block });
    expect(settingsFrom({ definitionRole: `document:${role}` }, NO_SETTINGS).definitionRole).toEqual({ kind: "document", id: role });
    expect(settingsFrom({ definitionRole: { kind: "block", id: block } }, NO_SETTINGS).definitionRole).toEqual({ kind: "block", id: block });
    expect(settingsFrom({ definitionRole: "" }, NO_SETTINGS).definitionRole).toBeNull();
  });

  it("refuses what is not a role", () => {
    expect(() => settingsFrom({ keywordRole: "story" }, NO_SETTINGS)).toThrow(/names a role by its id/u);
    expect(() => settingsFrom({ definitionRole: "chapter:x" }, NO_SETTINGS)).toThrow(/block:<id> or document:<id>/u);
    expect(() => settingsFrom({ definitionRole: { kind: "page", id: block } }, NO_SETTINGS)).toThrow(/kind, block or document/u);
  });
});

describe("the settings as stored", () => {
  it("reads a missing record as no choice, and drops a shape it does not know", () => {
    expect(settingsOf(null)).toEqual(NO_SETTINGS);
    expect(settingsOf({ id: "keywords", keywordRole: role, definitionRole: { kind: "document", id: role }, aliasRole: 7 })).toEqual({
      keywordRole: role,
      definitionRole: { kind: "document", id: role },
      aliasRole: null,
    });
    expect(settingsOf({ id: "keywords", definitionRole: { kind: "page", id: role } }).definitionRole).toBeNull();
  });
});
