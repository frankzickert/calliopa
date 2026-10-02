import { describe, expect, it, vi } from "vitest";

/**
 * A field asks the frame for suggestions and the extension owning the
 * source answers (`calliopa-bootstrap`'s `BO_0336_052`). The generated
 * registry is the build's own seam, so it is what this test supplies; the
 * frame's reading of it is the real one.
 */
vi.mock("~/registry.gen", () => ({ REGISTRY: { kinds: {}, sections: [] } }));
vi.mock("~/registry.server.gen", () => ({
  SERVER_REGISTRY: {
    suggestionSources: {
      "media:provider": {
        extension: "media",
        name: "provider",
        label: "Generation services",
        answer: async (values: Readonly<Record<string, string>>) => ({
          suggestions: [{ value: "higgsfield", label: "Higgsfield" }],
          ...(values["type"] === undefined ? {} : { note: `for ${values["type"]}` }),
        }),
      },
      "media:broken": {
        extension: "media",
        name: "broken",
        label: "Broken",
        answer: async () => {
          throw new Error("vendor down");
        },
      },
    },
  },
}));

const { suggest, suggestionSources } = await import("./registry");

describe("suggestions a field asks for", () => {
  it("Given a source the build answers, Then its extension answers it with the subject's values", async () => {
    expect(await suggest("media:provider", { type: "image" })).toEqual({
      suggestions: [{ value: "higgsfield", label: "Higgsfield" }],
      note: "for image",
    });
  });

  it("Given a source nothing answers, Then there is no answer, which the route says as 404", async () => {
    expect(await suggest("media:model", {})).toBeUndefined();
  });

  it("Given a source that fails, Then it suggests nothing and says so, and the field stays typeable", async () => {
    expect(await suggest("media:broken", {})).toEqual({ suggestions: [], note: "No suggestions could be read just now." });
  });

  it("lists the sources a person may pick for their own field, qualified and labelled", () => {
    expect(suggestionSources()).toEqual([
      { source: "media:provider", label: "Generation services" },
      { source: "media:broken", label: "Broken" },
    ]);
  });
});
