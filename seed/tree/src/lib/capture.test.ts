import { describe, expect, it } from "vitest";

import { capturedFile } from "./capture";

/** What the host hands over arrives as the file it is, byte for byte. BO_0319_050 */
describe("a captured item as a file", () => {
  it("Given a file the host captured, Then its name, type and bytes are the file's", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x7f, 0x80]);
    const data = btoa(String.fromCharCode(...bytes));
    const file = capturedFile({ kind: "file", name: "Photo 1.jpg", mimeType: "image/jpeg", data });
    expect(file?.name).toBe("Photo 1.jpg");
    expect(file?.type).toBe("image/jpeg");
    expect(new Uint8Array(await file!.arrayBuffer())).toEqual(bytes);
  });

  it("Given a text or an address, Then it is no file", () => {
    expect(capturedFile({ kind: "text", text: "a line" })).toBeNull();
    expect(capturedFile({ kind: "address", address: "https://example.org/" })).toBeNull();
  });
});
