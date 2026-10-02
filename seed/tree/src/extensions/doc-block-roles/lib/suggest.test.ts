import { describe, expect, it } from "vitest";

import { takeableFrom, type RoleView } from "./roles";
import { offerDistance, suggestRoles } from "./suggest";

/**
 * The suggestions (`BO_0309_022`): the structure first, the nearer offer
 * first, then the block's words against a role's name, description and field
 * names; at most three, none already taken, nothing when nothing scores.
 */
const role = (id: string, name: string, extra: Partial<RoleView> = {}): RoleView => ({
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

const story = role("story", "Story", { offers: ["hook"] });
const section = role("section", "Section", { offers: ["claim"] });
const hook = role("hook", "Hook", { offeredBy: ["story"] });
const claim = role("claim", "Claim", { offeredBy: ["section"] });
const blog = role("blog", "Blog post", {
  description: "A post for the company blog",
  fields: [{ key: "d", name: "Publishing date", type: "date", required: true }],
});
const recipe = role("recipe", "Recipe", { description: "Ingredients and steps" });
const invoice = role("invoice", "Invoice", { fields: [{ key: "a", name: "Amount", type: "number", required: true }] });
const roles = [story, section, hook, claim, blog, recipe, invoice];
const all = roles.map((each) => each.id);

describe("suggestRoles", () => {
  it("ranks a role offered from above first, the nearer offer before the farther", () => {
    const distance = offerDistance(roles, [["section"], [], ["story"]]);
    expect(distance.get("claim")).toBe(0);
    expect(distance.get("hook")).toBe(2);
    expect(suggestRoles({ roles, takeable: all, distance, words: "", taken: ["section"] })).toEqual(["claim", "hook"]);
  });

  it("matches the block's words against a role's name, then its description and field names", () => {
    const suggested = suggestRoles({ roles, takeable: all, distance: new Map(), words: "Publishing plan: the posts for our blog next week", taken: [] });
    expect(suggested).toEqual(["blog"]);
    expect(suggestRoles({ roles, takeable: all, distance: new Map(), words: "Three ingredients, five steps", taken: [] })).toEqual(["recipe"]);
    expect(suggestRoles({ roles, takeable: all, distance: new Map(), words: "The amount due", taken: [] })).toEqual(["invoice"]);
  });

  it("suggests at most three, none the block carries or cannot take, and nothing when nothing scores", () => {
    const distance = offerDistance(roles, [["story", "section"]]);
    expect(suggestRoles({ roles, takeable: all, distance, words: "our blog post recipe", taken: [] })).toHaveLength(3);
    expect(suggestRoles({ roles, takeable: all.filter((each) => each !== "blog"), distance: new Map(), words: "blog post", taken: [] })).toEqual([]);
    expect(suggestRoles({ roles, takeable: all, distance: new Map(), words: "blog post", taken: ["blog"] })).toEqual([]);
    expect(suggestRoles({ roles, takeable: all, distance: new Map(), words: "the and for with", taken: [] })).toEqual([]);
  });
});

describe("a role blocks may not take (BO_0332_013)", () => {
  it("is never suggested to a block, however well its words meet it, and is to the document", () => {
    const documentBlog = { ...blog, blocks: false };
    const withDocumentRole = [story, section, hook, claim, documentBlog, recipe, invoice];
    const words = "Publishing plan: the posts for our blog next week";
    const onBlock = takeableFrom(withDocumentRole, [], true);
    expect(suggestRoles({ roles: withDocumentRole, takeable: onBlock, distance: new Map(), words, taken: [] })).toEqual([]);
    const onDocument = takeableFrom(withDocumentRole, [], false);
    expect(suggestRoles({ roles: withDocumentRole, takeable: onDocument, distance: new Map(), words, taken: [] })).toEqual(["blog"]);
  });
});
