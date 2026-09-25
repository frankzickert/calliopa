import { describe, expect, it } from "vitest";

import { isUnnamed, UNNAMED_DOCUMENT, UNNAMED_PROFILE, unnamedTitle } from "./naming";

/** What counts as a document nobody has named. DO_0012_001 */
describe("the name a document is minted with", () => {
  it("Given the minted name, Then the document is unnamed", () => {
    expect(isUnnamed(UNNAMED_DOCUMENT)).toBe(true);
  });

  it("Given a name somebody wrote, Then the document is named", () => {
    expect(isUnnamed("Release plan")).toBe(false);
    expect(isUnnamed("")).toBe(false);
  });

  it("Given a title that only begins with the minted name, Then the document is named", () => {
    expect(isUnnamed(`${UNNAMED_DOCUMENT} 2`)).toBe(false);
    expect(isUnnamed(` ${UNNAMED_DOCUMENT}`)).toBe(false);
  });

  it("Given other words in the same shape, Then the document is named", () => {
    expect(isUnnamed("untitled document")).toBe(false);
    expect(isUnnamed("Untitled")).toBe(false);
  });
});

/** A profile is minted under its own name, unnamed by the same rule. BO_0298_014 */
describe("the name a profile is minted with", () => {
  it("Given the minted name, Then the profile is unnamed, and the placeholder follows the record", () => {
    expect(isUnnamed(UNNAMED_PROFILE)).toBe(true);
    expect(unnamedTitle({ record: "profile" })).toBe(UNNAMED_PROFILE);
    expect(unnamedTitle({})).toBe(UNNAMED_DOCUMENT);
    expect(unnamedTitle(null)).toBe(UNNAMED_DOCUMENT);
  });
});

