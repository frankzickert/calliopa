import { describe, expect, it } from "vitest";
import { dockAfterRelease, dockAfterSwipe, dockAfterTap } from "./layout";

describe("mobile dock movement", () => {
  it("Given a tap, Then an open dock closes and a closed one opens to the composer", () => {
    expect(dockAfterTap("composer")).toBe("collapsed");
    expect(dockAfterTap("console")).toBe("collapsed");
    expect(dockAfterTap("collapsed")).toBe("composer");
  });

  it("Given a deliberate vertical swipe, Then the dock moves one bounded step", () => {
    expect(dockAfterSwipe("composer", -80)).toBe("console");
    expect(dockAfterSwipe("composer", 80)).toBe("collapsed");
    expect(dockAfterSwipe("composer", 10)).toBe("composer");
    expect(dockAfterSwipe("console", -80)).toBe("console");
  });
});

describe("a release on the dock handle", () => {
  it("Given a press that barely moved, Then the release is a tap", () => {
    expect(dockAfterRelease("composer", 600, 600)).toBe("collapsed");
    expect(dockAfterRelease("composer", 600, 620)).toBe("collapsed");
    expect(dockAfterRelease("console", 600, 561)).toBe("collapsed");
    expect(dockAfterRelease("collapsed", 600, 610)).toBe("composer");
  });

  it("Given a press that travelled past the threshold, Then the release is a swipe", () => {
    expect(dockAfterRelease("composer", 600, 520)).toBe("console");
    expect(dockAfterRelease("composer", 520, 600)).toBe("collapsed");
    expect(dockAfterRelease("composer", 600, 560)).toBe("console");
  });

  it("Given no press was recorded, Then the release is never a swipe", () => {
    // The first interaction can release before the press handler has resolved.
    // `600` is the pointer's own coordinate near the bottom of a viewport, and
    // measuring it against an initial `0` is the downward swipe that moved the
    // dock backwards.
    expect(dockAfterRelease("composer", null, 600)).toBe("collapsed");
    expect(dockAfterRelease("collapsed", null, 600)).toBe("composer");
    expect(dockAfterRelease("console", null, 600)).toBe("collapsed");
  });
});
