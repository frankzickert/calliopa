import { describe, expect, it } from "vitest";

import { styleFor, stylesAnswer } from "./styles";

/** Which style a document's citations are set in, and what the resolver
 * says of the styles. BO_0291_037 */
describe("the style a document is set in (BO_0291_037)", () => {
  it("takes the asked style, else the document's own choice, else the instance's default", () => {
    expect(styleFor("chicago-author-date", "apa", "ieee")).toBe("chicago-author-date");
    expect(styleFor(undefined, "apa", "ieee")).toBe("apa");
    expect(styleFor(undefined, undefined, "apa")).toBe("apa");
  });

  it("falls back past a choice that names no shipped style", () => {
    expect(styleFor("harvard", "mla", "ieee")).toBe("ieee");
  });

  it("answers the applied style, the default and every shipped style by name", () => {
    expect(stylesAnswer("apa", "ieee")).toEqual({
      applied: "apa",
      instanceDefault: "ieee",
      offered: [
        { id: "ieee", name: "IEEE" },
        { id: "apa", name: "APA (7th edition)" },
        { id: "chicago-author-date", name: "Chicago author-date" },
      ],
    });
  });
});
