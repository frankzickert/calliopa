import { describe, expect, it } from "vitest";

import { chordDirection, clickMarks, passageNumberAt } from "./press";

const key = (init: Partial<KeyboardEvent>) =>
  ({
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    key: "",
    ...init,
  }) as KeyboardEvent;

describe("the standing chord", () => {
  it("Given Alt+Shift with a horizontal arrow, Then it steps in that direction", () => {
    expect(
      chordDirection(key({ altKey: true, shiftKey: true, key: "ArrowRight" })),
    ).toBe("right");
    expect(
      chordDirection(key({ altKey: true, shiftKey: true, key: "ArrowLeft" })),
    ).toBe("left");
  });

  it("Given a bare Alt+arrow, the browser's history, or any other chord, Then it is not the standing chord", () => {
    expect(chordDirection(key({ altKey: true, key: "ArrowLeft" }))).toBeNull();
    expect(
      chordDirection(key({ shiftKey: true, key: "ArrowLeft" })),
    ).toBeNull();
    expect(
      chordDirection(
        key({ altKey: true, shiftKey: true, ctrlKey: true, key: "ArrowLeft" }),
      ),
    ).toBeNull();
    expect(
      chordDirection(key({ altKey: true, shiftKey: true, key: "ArrowUp" })),
    ).toBeNull();
  });
});

describe("what a click in command mode means", () => {
  const inside = {} as Node;
  const elsewhere = {} as Node;
  const rowWith = (
    selection: { isCollapsed: boolean; anchorNode: Node } | null,
  ) =>
    ({
      ownerDocument: { getSelection: () => selection },
      contains: (node: Node | null) => node === inside,
    }) as unknown as HTMLElement;

  it("Given a press that did not move, Then it marks the block", () => {
    expect(clickMarks(rowWith(null))).toBe(true);
    expect(clickMarks(rowWith({ isCollapsed: true, anchorNode: inside }))).toBe(
      true,
    );
  });

  it("Given a drag that selected words in this block, Then the click it left behind marks nothing — BO_0137's defect", () => {
    expect(
      clickMarks(rowWith({ isCollapsed: false, anchorNode: inside })),
    ).toBe(false);
  });

  it("Given words selected in another block, Then a press here still marks this one", () => {
    expect(
      clickMarks(rowWith({ isCollapsed: false, anchorNode: elsewhere })),
    ).toBe(true);
  });
});

describe("a press on a passage's number", () => {
  const at = (attributes: Record<string, string> | null) =>
    ({
      closest: () =>
        attributes === null
          ? null
          : { getAttribute: (name: string) => attributes[name] ?? null },
    }) as unknown as EventTarget;

  it("Given the number of a passage, standing or stale, Then that passage is the one pressed", () => {
    expect(passageNumberAt(at({ "data-passage-number": "2" }))).toBe(2);
    expect(passageNumberAt(at({ "data-passage-stale": "3" }))).toBe(3);
  });

  it("Given anywhere else, Then no passage was pressed and the block's own press stands", () => {
    expect(passageNumberAt(at(null))).toBeNull();
    expect(passageNumberAt(null)).toBeNull();
  });
});
