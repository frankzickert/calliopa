import { builtinModules } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The rule that keeps the server half on the port, so the device build runs
 * it unchanged: no module of `src/server/`, `src/routes/` or any extension's
 * `server/` reaches Node, the environment or HTTP but through the port —
 * the port itself (`src/server/port/`) and the adapters (`adapters/`), which
 * answer it, excepted, and tests too. CA_0075_002
 */

const builtins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);

/** What a module reached that the port answers, each named. */
export function reachedPastThePort(source: string): string[] {
  // Comments and strings say what they like; the code is what reaches.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:])\/\/.*$/gmu, "$1");
  const reached: string[] = [];
  for (const match of code.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gmu,
  )) {
    const specifier = match[1] ?? "";
    if (builtins.has(specifier) || specifier.startsWith("node:"))
      reached.push(`imports ${specifier}`);
  }
  if (/\bprocess\.env\b/u.test(code)) reached.push("reads process.env");
  if (/\bAsyncLocalStorage\b/u.test(code))
    reached.push("uses AsyncLocalStorage");
  // The global fetch, not a method of that name: nothing before it but an
  // operator, a bracket or the start of an expression.
  if (
    /(?<![\w$.\]'"`])(?:globalThis\.)?fetch\s*\(/u.test(
      code.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/gu, '""'),
    )
  ) {
    reached.push("calls the global fetch");
  }
  return reached;
}

function modules(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return modules(path);
    return /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : [];
  });
}

function serverModules(): string[] {
  const extensions = readdirSync("src/extensions")
    .map((id) => join("src/extensions", id, "server"))
    .filter((path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    });
  return [
    ...modules("src/server"),
    ...modules("src/routes"),
    ...extensions.flatMap(modules),
  ].filter((path) => !path.startsWith(join("src", "server", "port")));
}

describe("the server half on the port", () => {
  it("Given every server module, Then none reaches Node, the environment or HTTP but through the port", () => {
    const offending = serverModules().flatMap((path) =>
      reachedPastThePort(readFileSync(path, "utf8")).map(
        (what) => `${path} ${what}`,
      ),
    );
    expect(offending).toEqual([]);
  });

  it("Given a module reaching past the port, Then the rule names what it reached", () => {
    expect(
      reachedPastThePort('import { readFile } from "node:fs/promises";'),
    ).toEqual(["imports node:fs/promises"]);
    expect(reachedPastThePort('import { join } from "path";')).toEqual([
      "imports path",
    ]);
    expect(
      reachedPastThePort("const dir = process.env.CALLIOPA_MEDIA_CONFIG_DIR;"),
    ).toEqual(["reads process.env"]);
    expect(
      reachedPastThePort("const store = new AsyncLocalStorage();"),
    ).toEqual(["uses AsyncLocalStorage"]);
    expect(reachedPastThePort("const answer = await fetch(url);")).toEqual([
      "calls the global fetch",
    ]);
    expect(reachedPastThePort("return globalThis.fetch(url);")).toEqual([
      "calls the global fetch",
    ]);
  });

  it("Given a module on the port, Then the rule finds nothing", () => {
    expect(
      reachedPastThePort(
        [
          'import { port } from "~/server/port";',
          "// fetch(url) in a comment, process.env in a comment",
          "/* import fs from 'node:fs' */",
          'const said = "the kernel could not fetch(it)";',
          'const answer = await port.fetch("https://example.com");',
          'const routed = await port.kernel("/__kernel/state/settings");',
          "const prefetch = (url: string) => url;",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
