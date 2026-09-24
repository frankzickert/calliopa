import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Where the engine may be reached from (`BO_0290_019`).
 *
 * This is the guard behind the requirement that equations never move the text
 * around them. An equation cannot arrive late if nothing can typeset it late:
 * the server sets every equation as it reads the document, and the browser
 * loads MathJax only to *edit* one. A build proves it — the engine lands in a
 * chunk of its own, reached by `import(…)` and by nothing else — but a build
 * is slow and a source rule is not, so the rule is pinned here.
 *
 * Reading the sources rather than the bundle is deliberate: what would break
 * this is someone adding an ordinary import, and that is visible in the text
 * long before it is visible in a chunk graph.
 */
/** `src`, three directories up from this file. */
const SRC = join(import.meta.dirname, "..", "..", "..");

/** Every TypeScript source under a directory, recursively, tests aside. */
function sourcesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      found.push(...sourcesUnder(path));
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    found.push(path);
  }
  return found;
}

const STATIC_IMPORT = /^\s*import\s[^;]*?from\s+["'][^"']*lib\/mathjax["']/mu;
const DYNAMIC_IMPORT = /import\(\s*["'][^"']*lib\/mathjax["']\s*\)/u;

describe("what may reach the typesetting engine", () => {
  const sources = sourcesUnder(SRC).map((path) => ({
    path: `src/${path.slice(SRC.length + 1)}`,
    text: readFileSync(path, "utf8"),
  }));

  const importsOutright = (text: string): boolean =>
    new RegExp(STATIC_IMPORT.source, "mu").test(text);

  it("is imported outright by the assembler alone, which runs on the server", () => {
    const outright = sources
      .filter((source) => importsOutright(source.text))
      .map((source) => source.path);
    expect(outright).toEqual(["src/extensions/documents/server/assemble.ts"]);
  });

  it("is reached from the browser only by a lazy import, and only where editing happens", () => {
    // Two, and both are editing: the popover's preview, and the surface
    // setting an equation typed a moment ago, which has markup from nowhere
    // (`BO_0290_027`). Reading reaches the engine through neither.
    const lazy = sources.filter((source) => DYNAMIC_IMPORT.test(source.text)).map((source) => source.path).sort();
    expect(lazy).toEqual([
      "src/extensions/documents/views/equation-popover.tsx",
      "src/extensions/documents/views/typeset-client.ts",
    ]);
  });

  it("never reaches a view outright, which is what keeps it out of the reading bundle", () => {
    // A view imports the assembler's *types* only, and a type import is erased
    // at build time — so drawing a document pulls in no engine at all.
    const views = sources.filter((source) => source.path.includes("/views/"));
    for (const view of views) {
      expect(importsOutright(view.text)).toBe(false);
    }
  });
});
