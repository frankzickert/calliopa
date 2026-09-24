import { describe, expect, it } from "vitest";
import { kernelCallbackRefusal } from "./kernel-callback";

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
