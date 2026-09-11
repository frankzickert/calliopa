import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The dock is a layer above the document. A dock grown taller than the room
 * left to it had the document's positioned rows painted over its handle, and
 * a finger on a phone reached the rows: the dock opened and never closed.
 * No layout runs here, so the rule that prevents it is held where it lives:
 * no layer a view draws in the flow reaches the dock's. A view's fixed
 * overlays — a drag's reveal, the selection's affordance — are meant to lie
 * over everything and are not in the flow. BO_0230_003
 */

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

/** Each innermost rule's selector and declarations; a media query's rules
 * are read as the rules they hold. */
function rules(css: string): { selector: string; body: string }[] {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return Array.from(uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selector: match[1]!.trim(),
    body: match[2]!,
  }));
}

const zIndex = (body: string): number | null => {
  const found = /z-index:\s*(-?\d+)/.exec(body);
  return found === null ? null : Number(found[1]);
};

describe("the dock's layer", () => {
  it("Given the shell's stylesheet, Then the dock is positioned with a layer of its own", () => {
    const dock = rules(
      readFileSync("src/components/shell/shell.css", "utf8"),
    ).find((rule) => rule.selector === ".dock");
    expect(dock?.body).toMatch(/position:\s*relative/);
    expect(zIndex(dock?.body ?? "")).toBeGreaterThan(0);
  });

  it("Given every view's stylesheet, Then no layer it draws in the flow reaches the dock's", () => {
    const dock = rules(
      readFileSync("src/components/shell/shell.css", "utf8"),
    ).find((rule) => rule.selector === ".dock");
    const layer = zIndex(dock?.body ?? "") ?? 0;
    const reaching = stylesheets("src")
      .filter((path) => !path.startsWith(join("src", "components", "shell")))
      .flatMap((path) =>
        rules(readFileSync(path, "utf8"))
          .filter((rule) => !/position:\s*fixed/.test(rule.body))
          .filter((rule) => (zIndex(rule.body) ?? 0) >= layer)
          .map((rule) => `${path}: ${rule.selector}`),
      );
    expect(reaching).toEqual([]);
  });
});
