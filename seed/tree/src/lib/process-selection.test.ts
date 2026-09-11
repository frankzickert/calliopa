import { describe, expect, it } from "vitest";
import {
  keepOpenTabs,
  NO_SELECTION,
  pressProcess,
  releaseProcess,
  selectedProcess,
} from "./process-selection";

/** CA_0040_001 CA_0040_002 CA_0040_003 */
describe("the selected process, held per tab", () => {
  it("Given a process pressed on one tab, Then another tab has none selected", () => {
    const selection = pressProcess(NO_SELECTION, "a", "p1");
    expect(selectedProcess(selection, "a")).toBe("p1");
    expect(selectedProcess(selection, "b")).toBeNull();
  });

  it("Given each tab chose its own, Then each keeps it", () => {
    const selection = pressProcess(
      pressProcess(NO_SELECTION, "a", "p1"),
      "b",
      "p2",
    );
    expect(selectedProcess(selection, "a")).toBe("p1");
    expect(selectedProcess(selection, "b")).toBe("p2");
  });

  it("Given no tab open, Then the empty workspace holds its own", () => {
    const selection = pressProcess(
      pressProcess(NO_SELECTION, null, "p1"),
      "a",
      "p2",
    );
    expect(selectedProcess(selection, null)).toBe("p1");
    expect(selectedProcess(selection, "a")).toBe("p2");
  });

  it("Given the selected row pressed again, Then the tab's selection is released", () => {
    const selection = pressProcess(
      pressProcess(NO_SELECTION, "a", "p1"),
      "a",
      "p1",
    );
    expect(selectedProcess(selection, "a")).toBeNull();
  });

  it("Given a different row pressed, Then the selection moves to it", () => {
    const selection = pressProcess(
      pressProcess(NO_SELECTION, "a", "p1"),
      "a",
      "p2",
    );
    expect(selectedProcess(selection, "a")).toBe("p2");
  });

  it("Given a release, Then only that tab lets go", () => {
    const both = pressProcess(pressProcess(NO_SELECTION, "a", "p1"), "b", "p2");
    const released = releaseProcess(both, "a");
    expect(selectedProcess(released, "a")).toBeNull();
    expect(selectedProcess(released, "b")).toBe("p2");
    expect(
      selectedProcess(
        releaseProcess(pressProcess(NO_SELECTION, null, "p1"), null),
        null,
      ),
    ).toBeNull();
  });

  it("Given a tab closed, Then its selection goes with it and a reopened tab starts with none", () => {
    const both = pressProcess(pressProcess(NO_SELECTION, "a", "p1"), "b", "p2");
    const kept = keepOpenTabs(both, [{ id: "b" }]);
    expect(selectedProcess(kept, "a")).toBeNull();
    expect(selectedProcess(kept, "b")).toBe("p2");
  });

  it("Given every selection's tab still open, Then keeping them answers the same selection", () => {
    const both = pressProcess(pressProcess(NO_SELECTION, "a", "p1"), "b", "p2");
    expect(keepOpenTabs(both, [{ id: "a" }, { id: "b" }, { id: "c" }])).toBe(
      both,
    );
  });

  it("Given every tab closed, Then the empty workspace's own is kept", () => {
    const selection = pressProcess(
      pressProcess(NO_SELECTION, null, "p1"),
      "a",
      "p2",
    );
    const kept = keepOpenTabs(selection, []);
    expect(selectedProcess(kept, null)).toBe("p1");
    expect(selectedProcess(kept, "a")).toBeNull();
  });
});
