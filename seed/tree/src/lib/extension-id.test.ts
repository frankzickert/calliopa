import { describe, expect, it } from "vitest";

import { isExtensionId } from "./extension-id";

describe("the extension id rule", () => {
  it("Given the ids the graph holds, Then every one satisfies it", () => {
    for (const id of ["ui.shell", "settings", "calliopa-base", "calliopa-extension", "calliopa-video", "demo", "a1.b-c"]) {
      expect(isExtensionId(id), id).toBe(true);
    }
  });
  it("Given a capital, a leading digit or separator, or a doubled separator, Then it is refused", () => {
    for (const id of ["Demo", "1demo", "-x", ".x", "a..b", "a-", "a b", "", "a/b"]) {
      expect(isExtensionId(id), id).toBe(false);
    }
  });
});
