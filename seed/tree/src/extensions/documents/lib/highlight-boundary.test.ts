import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Where the highlighter may be reached from (`BO_0296_012`), the shape
 * `mathjax-boundary.test.ts` set for the typesetting engine.
 *
 * Reading a coloured document fetches no grammar: the server colours every
 * code block as it reads the document, and the browser loads the engine only
 * to colour the block being written. A build proves it — the engine lands in
 * a chunk of its own, reached by `import(…)` and by nothing else — but a
 * build is slow and a source rule is not, so the rule is pinned here, in the
 * text, where someone adding an ordinary import would break it.
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

const STATIC_IMPORT = /^\s*import\s[^;]*?from\s+["'][^"']*(?:lib\/highlight|highlight\.js\b[^"']*)["']/mu;
const DYNAMIC_IMPORT = /import\(\s*["'][^"']*lib\/highlight["']\s*\)/u;

describe("what may reach the highlighter", () => {
  const sources = sourcesUnder(SRC).map((path) => ({
    path: `src/${path.slice(SRC.length + 1)}`,
    text: readFileSync(path, "utf8"),
  }));

  const importsOutright = (text: string): boolean => new RegExp(STATIC_IMPORT.source, "mu").test(text);

  it("is imported outright on the server alone: by the module that wraps it, by the assembler that colours a read, and by the model that guesses a language", () => {
    const outright = sources
      .filter((source) => importsOutright(source.text))
      .map((source) => source.path)
      .sort();
    expect(outright).toEqual([
      "src/extensions/documents/lib/highlight.ts",
      "src/extensions/documents/server/assemble.ts",
      "src/extensions/documents/server/documents.ts",
    ]);
  });

  it("is reached from the browser only by a lazy import, and only where the block is written", () => {
    const lazy = sources.filter((source) => DYNAMIC_IMPORT.test(source.text)).map((source) => source.path).sort();
    expect(lazy).toEqual(["src/extensions/documents/views/highlight-client.ts"]);
  });

  it("never reaches a view outright, which is what keeps it out of the reading bundle", () => {
    const views = sources.filter((source) => source.path.includes("/views/"));
    for (const view of views) {
      expect(importsOutright(view.text), view.path).toBe(false);
    }
  });
});
