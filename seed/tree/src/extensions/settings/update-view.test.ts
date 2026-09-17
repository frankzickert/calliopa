import { describe, expect, it } from "vitest";

import type { UpdateView } from "~/server/kernel/update";
import { supersedes, unserved, updateRunning, type Phase } from "./update-view";

/**
 * A pending update never blocks another; the tab says which pending update a
 * choice supersedes; and *Promote* follows the kernel's answer rather than
 * the page's own history. BO_0242_005
 */
const view = (over: Partial<UpdateView>): UpdateView => ({
  release: "0.3.9",
  updateCheck: true,
  updater: { state: "idle" },
  pending: null,
  ...over,
});

describe("updateRunning", () => {
  it("holds the update back only while an install, a restart or a promotion runs", () => {
    const phases: Phase[] = ["idle", "running", "waiting", "returned", "accepted", "promoting", "served", "failed"];
    expect(phases.filter(updateRunning)).toEqual(["running", "waiting", "promoting"]);
  });
});

describe("supersedes", () => {
  it("names the pending update's release when another release is chosen", () => {
    const info = view({ pending: { proposal: "node:chg-1", version: "0.3.9" } });
    expect(supersedes(info, "0.4.0")).toBe("0.3.9");
    expect(supersedes(info, "0.3.9")).toBeNull();
  });

  it("names nothing without a pending update", () => {
    expect(supersedes(view({}), "0.4.0")).toBeNull();
    expect(supersedes(null, "0.4.0")).toBeNull();
  });
});

describe("unserved", () => {
  it("is true while accepted extension truth is past the served pin", () => {
    expect(unserved(view({ servedPin: 50, extensionTruth: 57 }))).toBe(true);
    expect(unserved(view({ extensionTruth: 3 }))).toBe(true);
  });

  it("is false once it is served, or when the kernel does not say", () => {
    expect(unserved(view({ servedPin: 57, extensionTruth: 57 }))).toBe(false);
    expect(unserved(view({ servedPin: 57 }))).toBe(false);
    expect(unserved(null)).toBe(false);
  });
});
