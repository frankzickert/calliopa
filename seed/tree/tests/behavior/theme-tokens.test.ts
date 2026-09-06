import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stylesheets(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? stylesheets(path)
      : name.endsWith(".css")
        ? [path]
        : [];
  });
}

describe("component theme colors", () => {
  it("Given every source stylesheet, Then none bypasses semantic tokens", () => {
    const literalColor = /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i;
    for (const path of stylesheets("src")) {
      const offending = readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => literalColor.test(line));
      expect(offending, path).toEqual([]);
    }
  });
});
