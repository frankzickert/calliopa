import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  emitClient,
  emitServer,
  RegistryScanError,
  satisfies,
  scanExtensions,
  writeRegistry,
} from "../scripts/registry.mjs";

/**
 * The registry plugin's scan over fixture trees: what it emits for the
 * extensions present, and every named error it fails a build with. The
 * fixture trees are written under a temporary directory per test, never the
 * tree itself. BO_0202_001 BO_0202_011
 */

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

interface Fixture {
  readonly manifest?: Record<string, unknown> | string;
  readonly client?: string;
  readonly server?: string;
}

function tree(extensions: Readonly<Record<string, Fixture>>): string {
  const root = mkdtempSync(join(tmpdir(), "registry-scan-"));
  roots.push(root);
  for (const [name, fixture] of Object.entries(extensions)) {
    const dir = join(root, "src", "extensions", name);
    mkdirSync(dir, { recursive: true });
    if (fixture.manifest !== undefined) {
      writeFileSync(
        join(dir, "manifest.json"),
        typeof fixture.manifest === "string"
          ? fixture.manifest
          : JSON.stringify(fixture.manifest),
      );
    }
    if (fixture.client !== undefined)
      writeFileSync(join(dir, "contributions.ts"), fixture.client);
    if (fixture.server !== undefined)
      writeFileSync(join(dir, "contributions.server.ts"), fixture.server);
  }
  return root;
}

const manifest = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  version: "1.0.0",
  category: "bundled",
  ...extra,
});
const CLIENT = "export const contributions = { kinds: {} };\n";
const SERVER = "export const contributions = { routes: [] };\n";

const code = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof RegistryScanError) return error.code;
    throw error;
  }
  return "no error";
};

describe("scanning the extensions present", () => {
  it("finds every extension, with the halves of its entrypoint that exist", () => {
    const root = tree({
      "ui.shell": {
        manifest: manifest("ui.shell", { entrypoint: "contributions" }),
        client: CLIENT,
        server: SERVER,
      },
      settings: {
        manifest: manifest("settings", {
          entrypoint: "contributions",
          dependencies: { "ui.shell": ">=0.1.0" },
        }),
        client: CLIENT,
      },
      "calliopa-base": { manifest: manifest("calliopa-base") },
    });
    const entries = scanExtensions(root);
    expect(entries.map((entry) => entry.id)).toEqual([
      "calliopa-base",
      "settings",
      "ui.shell",
    ]);
    expect(
      entries.map((entry) => [entry.client !== null, entry.server !== null]),
    ).toEqual([
      [false, false],
      [true, false],
      [true, true],
    ]);
  });

  it("emits one module per half importing only the halves present", () => {
    const root = tree({
      "ui.shell": {
        manifest: manifest("ui.shell", { entrypoint: "contributions" }),
        client: CLIENT,
        server: SERVER,
      },
      settings: {
        manifest: manifest("settings", { entrypoint: "contributions" }),
        client: CLIENT,
      },
    });
    const entries = scanExtensions(root);
    const client = emitClient(entries);
    const server = emitServer(entries);
    expect(client).toContain('from "~/extensions/ui.shell/contributions"');
    expect(client).toContain('from "~/extensions/settings/contributions"');
    expect(client).toContain('{ id: "settings", contributions: ext0 }');
    expect(server).toContain(
      'from "~/extensions/ui.shell/contributions.server"',
    );
    expect(server).not.toContain("settings/contributions");
    expect(server).toContain("buildServerRegistry([");
  });

  it("is the same build without an extension: its entry is simply absent", () => {
    const without = scanExtensions(
      tree({
        "ui.shell": {
          manifest: manifest("ui.shell", { entrypoint: "contributions" }),
          client: CLIENT,
        },
      }),
    );
    const client = emitClient(without);
    expect(client).toContain('from "~/extensions/ui.shell/contributions"');
    expect(client).not.toContain("settings");
    expect(client).toContain(
      'PRESENT_EXTENSIONS: readonly string[] = ["ui.shell"]',
    );
    expect(client.match(/\{ id: /gu)?.length).toBe(1);
  });

  it("writes both generated modules and rewrites nothing that is unchanged", () => {
    const root = tree({
      "ui.shell": {
        manifest: manifest("ui.shell", { entrypoint: "contributions" }),
        client: CLIENT,
        server: SERVER,
      },
    });
    expect(writeRegistry(root).written.length).toBe(2);
    expect(writeRegistry(root).written.length).toBe(0);
  });
});

describe("what fails the build by name", () => {
  it("a directory without a manifest", () => {
    expect(
      code(() => scanExtensions(tree({ stray: { client: CLIENT } }))),
    ).toBe("manifest_missing");
  });

  it("an id not matching its directory", () => {
    expect(
      code(() =>
        scanExtensions(tree({ settings: { manifest: manifest("setting") } })),
      ),
    ).toBe("id_mismatch");
  });

  it("an entrypoint naming no module", () => {
    expect(
      code(() =>
        scanExtensions(
          tree({
            a: { manifest: manifest("a", { entrypoint: "contributions" }) },
          }),
        ),
      ),
    ).toBe("entrypoint_missing");
  });

  it("an entrypoint that does not export the contract's shape", () => {
    expect(
      code(() =>
        scanExtensions(
          tree({
            a: {
              manifest: manifest("a", { entrypoint: "contributions" }),
              client: "export const x = 1;\n",
            },
          }),
        ),
      ),
    ).toBe("entrypoint_shape");
    expect(
      code(() =>
        scanExtensions(
          tree({
            a: {
              manifest: manifest("a", { entrypoint: "contributions" }),
              client: CLIENT,
              server: "export default {};\n",
            },
          }),
        ),
      ),
    ).toBe("entrypoint_shape");
    expect(
      code(() =>
        scanExtensions(
          tree({ a: { manifest: manifest("a", { entrypoint: "../x" }) } }),
        ),
      ),
    ).toBe("entrypoint_shape");
  });

  it("a declared dependency the tree does not hold", () => {
    expect(
      code(() =>
        scanExtensions(
          tree({
            a: {
              manifest: manifest("a", {
                dependencies: { "ui.shell": ">=0.1.0" },
              }),
            },
          }),
        ),
      ),
    ).toBe("dependency_missing");
  });

  it("a declared range the version present does not satisfy", () => {
    expect(
      code(() =>
        scanExtensions(
          tree({
            a: { manifest: manifest("a", { dependencies: { b: "^2.0.0" } }) },
            b: { manifest: manifest("b") },
          }),
        ),
      ),
    ).toBe("dependency_out_of_range");
    expect(
      scanExtensions(
        tree({
          a: {
            manifest: manifest("a", { dependencies: { b: ">=1.0.0 <2.0.0" } }),
          },
          b: { manifest: manifest("b") },
        }),
      ).map((entry) => entry.id),
    ).toEqual(["a", "b"]);
  });

  it("a manifest that is not JSON", () => {
    expect(
      code(() => scanExtensions(tree({ a: { manifest: "{not json" } }))),
    ).toBe("manifest_unreadable");
  });
});

describe("the range grammar the scan and the kernel share", () => {
  it("matches as node-semver does for the forms a manifest uses", () => {
    const cases: [string, string, boolean][] = [
      [">=0.1.0", "0.1.0", true],
      [">=0.1.0", "0.0.9", false],
      ["^1.2.3", "1.9.0", true],
      ["^1.2.3", "2.0.0", false],
      ["^0.2.3", "0.2.9", true],
      ["^0.2.3", "0.3.0", false],
      ["^0.0.3", "0.0.4", false],
      ["~1.2.3", "1.2.9", true],
      ["~1.2.3", "1.3.0", false],
      ["1.2.3", "1.2.3", true],
      ["1.2", "1.2.7", true],
      ["1", "1.5.0", true],
      ["*", "9.9.9", true],
      [">=1.0.0 <2.0.0", "2.0.0", false],
      ["1.0.0 || >=2.5.0", "2.5.1", true],
      [">=1.0.0", "1.0.0-beta", false],
      ["v1.2.3", "1.2.3", true],
      ["^a.b.c", "1.0.0", false],
      [">=1.0.0", "unversioned", false],
    ];
    for (const [range, version, want] of cases) {
      expect(satisfies(version, range), `${version} satisfies ${range}`).toBe(
        want,
      );
    }
  });
});
