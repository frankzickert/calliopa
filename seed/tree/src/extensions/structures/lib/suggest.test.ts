import { describe, expect, it } from "vitest";

import { takeableFrom, type StructureView } from "./structures";
import { offerDistance, suggestStructures } from "./suggest";

/**
 * The suggestions (`BO_0309_022`): the structure first, the nearer offer
 * first, then the block's words against a structure's name, description and field
 * names; at most three, none already taken, nothing when nothing scores.
 */
const structure = (id: string, name: string, extra: Partial<StructureView> = {}): StructureView => ({
  id,
  name,
  description: "",
  retired: false,
  builtin: false,
  order: 1,
  fields: [],
  offers: [],
  offeredBy: [],
  blocks: true,
  ...extra,
});

const story = structure("story", "Story", { offers: ["hook"] });
const section = structure("section", "Section", { offers: ["claim"] });
const hook = structure("hook", "Hook", { offeredBy: ["story"] });
const claim = structure("claim", "Claim", { offeredBy: ["section"] });
const blog = structure("blog", "Blog post", {
  description: "A post for the company blog",
  fields: [{ key: "d", name: "Publishing date", type: "date", required: true }],
});
const recipe = structure("recipe", "Recipe", { description: "Ingredients and steps" });
const invoice = structure("invoice", "Invoice", { fields: [{ key: "a", name: "Amount", type: "number", required: true }] });
const structures = [story, section, hook, claim, blog, recipe, invoice];
const all = structures.map((each) => each.id);

describe("suggestStructures", () => {
  it("ranks a structure offered from above first, the nearer offer before the farther", () => {
    const distance = offerDistance(structures, [["section"], [], ["story"]]);
    expect(distance.get("claim")).toBe(0);
    expect(distance.get("hook")).toBe(2);
    expect(suggestStructures({ structures, takeable: all, distance, words: "", taken: ["section"] })).toEqual(["claim", "hook"]);
  });

  it("matches the block's words against a structure's name, then its description and field names", () => {
    const suggested = suggestStructures({ structures, takeable: all, distance: new Map(), words: "Publishing plan: the posts for our blog next week", taken: [] });
    expect(suggested).toEqual(["blog"]);
    expect(suggestStructures({ structures, takeable: all, distance: new Map(), words: "Three ingredients, five steps", taken: [] })).toEqual(["recipe"]);
    expect(suggestStructures({ structures, takeable: all, distance: new Map(), words: "The amount due", taken: [] })).toEqual(["invoice"]);
  });

  it("suggests at most three, none the block carries or cannot take, and nothing when nothing scores", () => {
    const distance = offerDistance(structures, [["story", "section"]]);
    expect(suggestStructures({ structures, takeable: all, distance, words: "our blog post recipe", taken: [] })).toHaveLength(3);
    expect(suggestStructures({ structures, takeable: all.filter((each) => each !== "blog"), distance: new Map(), words: "blog post", taken: [] })).toEqual([]);
    expect(suggestStructures({ structures, takeable: all, distance: new Map(), words: "blog post", taken: ["blog"] })).toEqual([]);
    expect(suggestStructures({ structures, takeable: all, distance: new Map(), words: "the and for with", taken: [] })).toEqual([]);
  });
});

describe("a structure blocks may not take (BO_0332_013)", () => {
  it("is never suggested to a block, however well its words meet it, and is to the document", () => {
    const documentBlog = { ...blog, blocks: false };
    const withDocumentStructure = [story, section, hook, claim, documentBlog, recipe, invoice];
    const words = "Publishing plan: the posts for our blog next week";
    const onBlock = takeableFrom(withDocumentStructure, [], true);
    expect(suggestStructures({ structures: withDocumentStructure, takeable: onBlock, distance: new Map(), words, taken: [] })).toEqual([]);
    const onDocument = takeableFrom(withDocumentStructure, [], false);
    expect(suggestStructures({ structures: withDocumentStructure, takeable: onDocument, distance: new Map(), words, taken: [] })).toEqual(["blog"]);
  });
});
