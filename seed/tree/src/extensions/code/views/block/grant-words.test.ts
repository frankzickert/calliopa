import { describe, expect, it } from "vitest";

import { grantWords } from "./send-control";

/** What a block's grant lets it reach, said under it on a device. BO_0319_046 */
describe("a code block's grant in words", () => {
  it("Given nothing granted, Then the block reaches nothing beyond compute", () => {
    expect(grantWords({ attachments: false, hosts: [] })).toBe("Runs in this device's sandbox and reaches nothing beyond compute.");
  });

  it("Given the files and hosts granted, Then each is named", () => {
    expect(grantWords({ attachments: true, hosts: ["api.open-meteo.com", "example.org"] })).toBe(
      "Runs in this device's sandbox and reads the document's files and fetches from api.open-meteo.com, example.org.",
    );
    expect(grantWords({ attachments: false, hosts: ["example.org"] })).toBe("Runs in this device's sandbox and fetches from example.org.");
  });
});
