import { describe, expect, it } from "vitest";
import { kernelCallbackRefusal, runScopeOf } from "./kernel-callback";

describe("kernel callback check (BO_0264_002)", () => {
  it("admits the kernel's exact secret", () => {
    expect(kernelCallbackRefusal("s3cret", "s3cret")).toBeNull();
  });
  it("refuses a missing or wrong secret", () => {
    expect(kernelCallbackRefusal(null, "s3cret")).toBe("only the kernel calls this route");
    expect(kernelCallbackRefusal("", "s3cret")).toBe("only the kernel calls this route");
    expect(kernelCallbackRefusal("s3cre", "s3cret")).toBe("only the kernel calls this route");
    expect(kernelCallbackRefusal("s3creT", "s3cret")).toBe("only the kernel calls this route");
  });
  it("answers nothing when the process has no secret", () => {
    expect(kernelCallbackRefusal("anything", undefined)).toMatch(/started without/);
    expect(kernelCallbackRefusal("", "")).toMatch(/started without/);
  });
});

describe("a run's read scope on a kernel callback (BO_0344_004)", () => {
  const headers = (entries: Record<string, string>) => new Headers(entries);
  it("reads the run's pin, and its group once it has staged", () => {
    expect(runScopeOf(headers({ "X-Calliopa-Run-Pin": "42" }))).toEqual({ pin: 42 });
    expect(runScopeOf(headers({ "X-Calliopa-Run-Pin": "42", "X-Calliopa-Run-Overlay": "node:run-1" }))).toEqual({ pin: 42, overlay: "node:run-1" });
  });
  it("answers no scope for a callback no run makes", () => {
    expect(runScopeOf(headers({}))).toBeUndefined();
    expect(runScopeOf(headers({ "X-Calliopa-Run-Overlay": "node:run-1" }))).toBeUndefined();
    expect(runScopeOf(headers({ "X-Calliopa-Run-Pin": "0" }))).toBeUndefined();
    expect(runScopeOf(headers({ "X-Calliopa-Run-Pin": "x" }))).toBeUndefined();
  });
});
