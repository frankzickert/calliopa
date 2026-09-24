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

/**
 * A stylesheet the browser cannot parse is a rule that silently does nothing:
 * the build only warns, and no test that reads a rule's text notices. Every
 * selector must balance its brackets and name something. CA_0058_009
 */
describe("every source stylesheet parses", () => {
  it("Given each selector, Then it balances its brackets and names something", () => {
    for (const path of stylesheets("src")) {
      const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
      const broken: string[] = [];
      let depth = 0;
      let prelude = "";
      for (const character of css) {
        if (character === "{") {
          if (depth === 0) {
            const selector = prelude.trim().replace(/\s+/gu, " ");
            const balanced =
              (selector.match(/\(/gu) ?? []).length === (selector.match(/\)/gu) ?? []).length &&
              (selector.match(/\[/gu) ?? []).length === (selector.match(/\]/gu) ?? []).length;
            // An at-rule's prelude is its own; a plain rule names selectors.
            if (!selector.startsWith("@") && (selector === "" || !balanced || /^[),]/u.test(selector))) {
              broken.push(selector);
            }
            prelude = "";
          }
          depth += 1;
        } else if (character === "}") {
          depth -= 1;
          prelude = "";
        } else if (depth === 0) {
          prelude += character;
        }
      }
      expect(broken, path).toEqual([]);
    }
  });
});
