import { describe, expect, it } from "vitest";

import { blockContentFor } from "./documents";

/**
 * A picture or a moving picture written into a document (`BO_0273_017`). Every
 * property is optional, and a block with no reference is a generation not made
 * yet — which is the whole of that state, so nothing has to be written to say
 * it is pending.
 */
describe("what a media block stores", () => {
  it("writes a pending block as its order alone", () => {
    expect(blockContentFor({ kind: "image" }, "a0")).toEqual({ order: "a0" });
  });

  it("writes the reference when the bytes exist", () => {
    const reference = { _kind: "blob", hash: "sha256:abc", mediaType: "image/png", size: 12 } as const;
    expect(blockContentFor({ kind: "image", reference }, "a0")).toEqual({ order: "a0", reference });
  });

  it("writes the box the block keeps, because the reference carries none", () => {
    expect(blockContentFor({ kind: "video", width: 1280, height: 720 }, "b0")).toEqual({
      order: "b0",
      width: 1280,
      height: 720,
    });
  });

  it("writes the words and what made it, and leaves empty words out", () => {
    const source = { extension: "media", model: "seedream_v5_pro" };
    expect(blockContentFor({ kind: "image", alt: "A laurel", source }, "c0")).toEqual({
      order: "c0",
      alt: "A laurel",
      source,
    });
    expect(blockContentFor({ kind: "image", alt: "" }, "c0")).toEqual({ order: "c0" });
  });

  it("leaves text and divider exactly as they were", () => {
    expect(blockContentFor({ kind: "divider" }, "d0")).toEqual({ order: "d0" });
    const text = blockContentFor({ kind: "text", runs: [{ text: "Opening." }] }, "e0");
    expect(text["order"]).toBe("e0");
    expect(text["runs"]).toEqual([{ text: "Opening." }]);
  });
});
