import { createOptimizer } from "@builder.io/qwik/optimizer";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Every closure the shell hands to `$()` reaches what it names from the
 * `Shell` component (`CA_0078_001`). The production build moves each closure
 * into a segment of its own and passes it only what was in scope where it was
 * captured, so a closure naming a store declared further down the component
 * throws `… is not defined` in the browser — `sendCommand$` did, naming
 * `commandOptions`. The dev transform the other tests run under keeps the
 * closures inline, so no render reaches the failure; this test runs the
 * optimizer as the build does and reads what each segment captures.
 */
const shellPath = fileURLToPath(new URL("./shell.tsx", import.meta.url));

/** The names `Shell`'s own body declares: what a segment may only reach by capturing it. */
function shellBodyNames(source: string): Set<string> {
  const file = ts.createSourceFile("shell.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>();
  const collect = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else for (const element of name.elements) if (!ts.isOmittedExpression(element)) collect(element.name);
  };
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "Shell") continue;
      const call = declaration.initializer;
      const body = call !== undefined && ts.isCallExpression(call) ? call.arguments[0] : undefined;
      if (body === undefined || !ts.isArrowFunction(body) || !ts.isBlock(body.body)) continue;
      for (const inner of body.body.statements) {
        if (ts.isVariableStatement(inner)) for (const d of inner.declarationList.declarations) collect(d.name);
        if (ts.isFunctionDeclaration(inner) && inner.name !== undefined) names.add(inner.name.text);
      }
    }
  }
  return names;
}

/** The identifiers a segment reads without declaring, importing or capturing them. */
function freeNames(code: string): Set<string> {
  const file = ts.createSourceFile("segment.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declared = new Set<string>();
  const read = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const isName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isBindingElement(parent) && parent.propertyName === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node) ||
        ts.isJsxAttribute(parent);
      const declares =
        ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) ||
          ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) ||
          ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) &&
          (parent as { name?: ts.Node }).name === node);
      if (declares) declared.add(node.text);
      else if (!isName) read.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return new Set([...read].filter((name) => !declared.has(name)));
}

describe("the shell's closures in the production build", () => {
  it("capture every name they read from the Shell component", async () => {
    const source = readFileSync(shellPath, "utf8");
    const component = shellBodyNames(source);
    expect(component.has("commandOptions")).toBe(true);

    const optimizer = await createOptimizer();
    const out = await optimizer.transformModules({
      input: [{ path: "shell.tsx", code: source }],
      srcDir: ".",
      mode: "prod",
      entryStrategy: { type: "segment" },
      minify: "none",
      transpileTs: true,
      transpileJsx: true,
      isServer: false,
    });
    const segments = out.modules.filter((module) => module.segment !== null);
    expect(segments.some((module) => module.segment?.displayName.includes("sendCommand"))).toBe(true);

    const unreachable = segments.flatMap((module) =>
      [...freeNames(module.code)]
        .filter((name) => component.has(name))
        .map((name) => `${module.segment?.displayName ?? module.path}: ${name}`),
    );
    expect(unreachable).toEqual([]);
  });
});
