import { describe, expect, it } from "vitest";

import {
  HEADER_MODE_SCRIPT,
  HEADER_MODE_STORAGE_KEY,
  menuStatusChange,
  otherHeaderMode,
  parseHeaderMode,
  QUIET_STATUS,
} from "./header-mode";

describe("the phone header's mode", () => {
  it("starts in Minimum: anything but a stored full reads so", () => {
    expect(parseHeaderMode(null)).toBe("minimum");
    expect(parseHeaderMode("")).toBe("minimum");
    expect(parseHeaderMode("wide")).toBe("minimum");
    expect(parseHeaderMode("minimum")).toBe("minimum");
    expect(parseHeaderMode("full")).toBe("full");
  });

  it("switches to the other mode", () => {
    expect(otherHeaderMode("full")).toBe("minimum");
    expect(otherHeaderMode("minimum")).toBe("full");
  });

  it("is applied before paint from the same key, with the same default", () => {
    const attributes = new Map<string, string>();
    const run = (stored: string | null) => {
      new Function("localStorage", "document", HEADER_MODE_SCRIPT)(
        { getItem: (key: string) => (key === HEADER_MODE_STORAGE_KEY ? stored : null) },
        { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } },
      );
      return attributes.get("data-header-mode");
    };
    expect(run(null)).toBe("minimum");
    expect(run("full")).toBe("full");
    expect(run("minimum")).toBe("minimum");
  });
});

describe("what the Minimum menu flashes", () => {
  const status = { ...QUIET_STATUS, save: "saved" as const };

  it("says nothing when nothing it holds changed", () => {
    expect(menuStatusChange(status, status)).toBeNull();
  });

  it("does not take a save state appearing or going with a tab for a change", () => {
    expect(menuStatusChange(QUIET_STATUS, status)).toBeNull();
    expect(menuStatusChange(status, QUIET_STATUS)).toBeNull();
  });

  it("flashes one save state following another", () => {
    expect(menuStatusChange(status, { ...status, save: "saving" })).toEqual({ kind: "save", state: "saving" });
  });

  it("flashes the process count going up and going down", () => {
    expect(menuStatusChange(status, { ...status, processes: 2 })).toEqual({ kind: "processes", count: 2 });
    expect(menuStatusChange({ ...status, processes: 2 }, status)).toEqual({ kind: "processes", count: 0 });
  });

  it("flashes an update or the licence warning appearing, even at the first reading", () => {
    expect(menuStatusChange(QUIET_STATUS, { ...QUIET_STATUS, update: "0.3.12" })).toEqual({ kind: "update", version: "0.3.12" });
    expect(menuStatusChange(QUIET_STATUS, { ...QUIET_STATUS, licence: "Expires soon." })).toEqual({ kind: "licence", text: "Expires soon." });
    expect(menuStatusChange({ ...QUIET_STATUS, update: "0.3.12" }, QUIET_STATUS)).toBeNull();
  });

  it("lets the change asking most for a decision win when several change at once", () => {
    const all = { save: "saving" as const, processes: 1, update: "0.3.12", licence: "Expires soon." };
    expect(menuStatusChange(status, all)?.kind).toBe("licence");
    expect(menuStatusChange(status, { ...all, licence: null })?.kind).toBe("update");
    expect(menuStatusChange(status, { ...all, licence: null, update: null })?.kind).toBe("processes");
  });
});
