import { describe, expect, it } from "vitest";
import { byOrder, orderBetween } from "./order";

/** Inserts a key between two bounds and asserts it lands strictly inside them,
 * which is the whole contract: an empty bound means no bound on that side. */
function between(before: string, after: string): string {
  const key = orderBetween(before, after);
  if (before !== "") {
    expect(key > before).toBe(true);
  }
  if (after !== "") {
    expect(key < after).toBe(true);
  }
  return key;
}

describe("minting an order key", () => {
  it("Given no siblings, When a document opens, Then it mints a key", () => {
    expect(between("", "")).not.toBe("");
  });

  it("Given a last sibling, When appending, Then the key sorts after it", () => {
    const first = between("", "");
    expect(between(first, "")).toBeTruthy();
  });

  it("Given a first sibling, When inserting before it, Then the key sorts ahead", () => {
    const first = between("", "");
    expect(between("", first)).toBeTruthy();
  });

  it("Given two siblings, When inserting between them, Then the key sorts inside", () => {
    const first = between("", "");
    const last = between(first, "");
    expect(between(first, last)).toBeTruthy();
  });

  it("Given adjacent keys, When inserting between them, Then the key lengthens rather than colliding", () => {
    const key = between("0i", "0j");
    expect(key.length).toBeGreaterThan(2);
  });

  it("Given repeated insertion at one point, Then every key stays strictly ordered", () => {
    let low = between("", "");
    const high = between(low, "");
    for (let round = 0; round < 40; round++) {
      low = between(low, high);
    }
  });

  it("Given repeated appends, Then keys stay ascending", () => {
    const keys: string[] = [];
    let last = "";
    for (let round = 0; round < 40; round++) {
      last = between(last, "");
      keys.push(last);
    }
    expect([...keys].sort()).toEqual(keys);
  });

  it("Given repeated insertion before the first key, Then keys stay descending", () => {
    const keys: string[] = [];
    let first = between("", "");
    for (let round = 0; round < 40; round++) {
      first = between("", first);
      keys.push(first);
    }
    expect([...keys].sort()).toEqual([...keys].reverse());
  });
});

describe("refusing an impossible order key", () => {
  it("Given bounds in the wrong order, Then it refuses", () => {
    expect(() => orderBetween("0j", "0i")).toThrow(RangeError);
  });

  it("Given equal bounds, Then it refuses", () => {
    expect(() => orderBetween("0i", "0i")).toThrow(RangeError);
  });

  it("Given an upper bound with nothing beneath it, Then it refuses", () => {
    expect(() => orderBetween("", "0")).toThrow(RangeError);
  });

  it("Given a bound outside the alphabet, Then it refuses", () => {
    expect(() => orderBetween("", "A")).toThrow(RangeError);
    expect(() => orderBetween("0-i", "")).toThrow(RangeError);
  });
});

describe("ordering siblings", () => {
  it("Given keys in any order, When sorting, Then they ascend by key", () => {
    const blocks = [
      { order: "z" },
      { order: "0i" },
      { order: "0ii" },
      { order: "i" },
    ];
    expect(byOrder(blocks).map((block) => block.order)).toEqual([
      "0i",
      "0ii",
      "i",
      "z",
    ]);
  });

  it("Given a sibling list, When sorting, Then the input is left alone", () => {
    const blocks = [{ order: "z" }, { order: "i" }];
    byOrder(blocks);
    expect(blocks.map((block) => block.order)).toEqual(["z", "i"]);
  });

  it("Given equal keys, When sorting, Then their existing order survives", () => {
    const blocks = [
      { order: "i", id: "first" },
      { order: "i", id: "second" },
    ];
    expect(byOrder(blocks).map((block) => block.id)).toEqual([
      "first",
      "second",
    ]);
  });
});
