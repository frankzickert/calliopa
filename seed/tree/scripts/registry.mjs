// The registry scan: what the Vite plugin runs at `configResolved` and what
// `pnpm gen` runs before tsc or vitest start. It reads
// `src/extensions/*/manifest.json`, checks what it can see on disk, and emits
// `src/registry.gen.ts` and `src/registry.server.gen.ts` importing every
// present entrypoint. The merge itself, with its collision errors, is
// `src/registry.ts`. Plain JavaScript so node runs it without a build. BO_0202_001
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export class RegistryScanError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = "RegistryScanError";
    this.code = code;
  }
}

const CLIENT_SHAPE = /export\s+const\s+contributions\b/u;
const SERVER_SHAPE = /export\s+const\s+contributions\b/u;

/**
 * Every extension directory under `src/extensions/`, in name order, with the
 * halves of its entrypoint that exist. Throws a named error for a directory
 * without a manifest, an id not matching its directory, an entrypoint that
 * resolves to no module, a half that does not export `contributions`, and a
 * declared dependency the tree does not hold.
 * @param {string} root
 * @returns {{ id: string, dir: string, manifest: Record<string, unknown>, client: string | null, server: string | null }[]}
 */
export function scanExtensions(root) {
  const base = join(root, "src", "extensions");
  const entries = [];
  const names = existsSync(base) ? readdirSync(base).sort() : [];
  for (const name of names) {
    const dir = join(base, name);
    if (!statSync(dir).isDirectory()) continue;
    const manifestPath = join(dir, "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new RegistryScanError(
        "manifest_missing",
        `src/extensions/${name} has no manifest.json`,
      );
    }
    /** @type {Record<string, unknown>} */
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (error) {
      throw new RegistryScanError(
        "manifest_unreadable",
        `src/extensions/${name}/manifest.json: ${String(error)}`,
      );
    }
    if (manifest.id !== name) {
      throw new RegistryScanError(
        "id_mismatch",
        `src/extensions/${name}/manifest.json declares id ${JSON.stringify(manifest.id)}`,
      );
    }
    let client = null;
    let server = null;
    if (manifest.entrypoint !== undefined) {
      if (
        typeof manifest.entrypoint !== "string" ||
        manifest.entrypoint === "" ||
        manifest.entrypoint.includes("/")
      ) {
        throw new RegistryScanError(
          "entrypoint_shape",
          `${name}: entrypoint must be a module name beside the manifest`,
        );
      }
      const stem = join(dir, manifest.entrypoint);
      client =
        [".ts", ".tsx"]
          .map((ext) => stem + ext)
          .find((file) => existsSync(file)) ?? null;
      server = existsSync(`${stem}.server.ts`) ? `${stem}.server.ts` : null;
      if (client === null && server === null) {
        throw new RegistryScanError(
          "entrypoint_missing",
          `${name}: entrypoint ${manifest.entrypoint} names neither ${manifest.entrypoint}.ts nor ${manifest.entrypoint}.server.ts`,
        );
      }
      if (client !== null && !CLIENT_SHAPE.test(readFileSync(client, "utf8"))) {
        throw new RegistryScanError(
          "entrypoint_shape",
          `${name}: ${relativeTo(root, client)} does not export \`contributions\``,
        );
      }
      if (server !== null && !SERVER_SHAPE.test(readFileSync(server, "utf8"))) {
        throw new RegistryScanError(
          "entrypoint_shape",
          `${name}: ${relativeTo(root, server)} does not export \`contributions\``,
        );
      }
    }
    entries.push({ id: name, dir, manifest, client, server });
  }
  const present = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    const dependencies = entry.manifest.dependencies;
    if (typeof dependencies !== "object" || dependencies === null) continue;
    for (const [dependency, range] of Object.entries(dependencies)) {
      const target = present.get(dependency);
      if (target === undefined) {
        throw new RegistryScanError(
          "dependency_missing",
          `${entry.id} depends on ${dependency}, which the tree does not hold`,
        );
      }
      // The range the manifest declares against the version the tree holds:
      // a tree assembled by any path — a pinned extension beside one at head —
      // fails by name here, as the kernel refuses the flip before writing it.
      // BO_0219_007
      const version =
        typeof target.manifest.version === "string"
          ? target.manifest.version
          : "";
      if (!satisfies(version, typeof range === "string" ? range : "*")) {
        throw new RegistryScanError(
          "dependency_out_of_range",
          `${entry.id} requires ${dependency} ${String(range)}, but the tree holds ${dependency} ${version || "without a version"}`,
        );
      }
    }
  }
  return entries;
}

/**
 * Whether a version satisfies a dependency range, in the grammar the kernel's
 * flip check reads: comparator sets joined by `||`, each a whitespace-separated
 * conjunction of `^x.y.z`, `~x.y.z`, `>=`, `>`, `<=`, `<`, `=` or a bare
 * version, with `*`, `x` and partial versions as x-ranges. A prerelease orders
 * before its release; build metadata is ignored. An unreadable version or
 * range does not satisfy. BO_0219_007
 * @param {string} version @param {string} range
 */
export function satisfies(version, range) {
  const parsed = parseVersion(version);
  if (parsed === null) return false;
  const alternatives = String(range).split("||");
  for (const alternative of alternatives) {
    const tokens = alternative
      .trim()
      .split(/\s+/u)
      .filter((token) => token !== "");
    let ok = true;
    for (const token of tokens) {
      const comparators = parseComparator(token);
      if (comparators === null) return false;
      if (!comparators.every(([op, bound]) => compareWith(op, parsed, bound))) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** @param {string} raw @returns {{ parts: number, v: [number, number, number], pre: string } | null} */
function parsePartial(raw) {
  let text = String(raw).trim().replace(/^v/u, "");
  if (text === "") return null;
  const plus = text.indexOf("+");
  if (plus >= 0) text = text.slice(0, plus);
  let pre = "";
  const dash = text.indexOf("-");
  if (dash >= 0) {
    pre = text.slice(dash + 1);
    text = text.slice(0, dash);
  }
  const fields = text.split(".");
  if (fields.length > 3) return null;
  /** @type {[number, number, number]} */
  const v = [0, 0, 0];
  let parts = 0;
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if (field === "x" || field === "X" || field === "*") break;
    if (!/^\d+$/u.test(field)) return null;
    v[i] = Number(field);
    parts = i + 1;
  }
  if (parts === 0 && !["x", "X", "*"].includes(fields[0])) return null;
  return { parts, v, pre };
}

/** @param {string} raw */
function parseVersion(raw) {
  const parsed = parsePartial(raw);
  return parsed !== null && parsed.parts === 3 ? parsed : null;
}

/** @param {{ v: [number, number, number], pre: string }} a @param {{ v: [number, number, number], pre: string }} b */
function compare(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a.v[i] !== b.v[i]) return a.v[i] - b.v[i];
  }
  if (a.pre === b.pre) return 0;
  if (a.pre === "") return 1;
  if (b.pre === "") return -1;
  return a.pre < b.pre ? -1 : 1;
}

/** @param {string} op @param {{ v: [number, number, number], pre: string }} a @param {{ v: [number, number, number], pre: string }} b */
function compareWith(op, a, b) {
  const d = compare(a, b);
  switch (op) {
    case ">=":
      return d >= 0;
    case ">":
      return d > 0;
    case "<=":
      return d <= 0;
    case "<":
      return d < 0;
    default:
      return d === 0;
  }
}

/** @param {[number, number, number]} v @param {string} pre */
const bound = (v, pre = "") => ({ v, pre });

/**
 * @param {string} token
 * @returns {[string, { v: [number, number, number], pre: string }][] | null}
 */
function parseComparator(token) {
  if (token === "*" || token === "x" || token === "X") return [];
  const ops = [">=", "<=", ">", "<", "="];
  for (const op of ops) {
    if (token.startsWith(op)) {
      const v = parseVersion(token.slice(op.length));
      return v === null ? null : [[op, v]];
    }
  }
  if (token.startsWith("^") || token.startsWith("~")) {
    const parsed = parsePartial(token.slice(1));
    if (parsed === null) return null;
    const [major, minor, patch] = parsed.v;
    let upper;
    if (token.startsWith("~")) {
      upper =
        parsed.parts < 2
          ? bound([major + 1, 0, 0])
          : bound([major, minor + 1, 0]);
    } else if (major !== 0 || parsed.parts === 1) {
      upper = bound([major + 1, 0, 0]);
    } else if (minor !== 0 || parsed.parts === 2) {
      upper = bound([major, minor + 1, 0]);
    } else {
      upper = bound([major, minor, patch + 1]);
    }
    return [
      [">=", parsed],
      ["<", upper],
    ];
  }
  const parsed = parsePartial(token);
  if (parsed === null) return null;
  const [major, minor] = parsed.v;
  switch (parsed.parts) {
    case 0:
      return [];
    case 1:
      return [
        [">=", parsed],
        ["<", bound([major + 1, 0, 0])],
      ];
    case 2:
      return [
        [">=", parsed],
        ["<", bound([major, minor + 1, 0])],
      ];
    default:
      return [["=", parsed]];
  }
}

/** @param {string} root @param {string} file */
function relativeTo(root, file) {
  return file.startsWith(root)
    ? file.slice(root.length).replace(/^[\\/]/u, "")
    : file;
}

const HEADER =
  "// Generated by scripts/registry.mjs from src/extensions/*/manifest.json.\n" +
  "// A *.gen.* module: the kernel never commits it and every build regenerates it. BO_0202_001\n";

/** @param {ReturnType<typeof scanExtensions>} entries */
export function emitClient(entries) {
  const withClient = entries.filter((entry) => entry.client !== null);
  const lines = [
    HEADER,
    'import { buildRegistry } from "~/registry";',
    'import { HOST_CONTRIBUTIONS } from "~/components/shell/host-contributions";',
    ...withClient.map(
      (entry, index) =>
        `import { contributions as ext${index} } from "~/extensions/${entry.id}/${moduleName(entry.client)}";`,
    ),
    "",
    `export const PRESENT_EXTENSIONS: readonly string[] = ${JSON.stringify(entries.map((entry) => entry.id))};`,
    "",
    "export const REGISTRY = buildRegistry(HOST_CONTRIBUTIONS, [",
    ...withClient.map(
      (entry, index) =>
        `  { id: ${JSON.stringify(entry.id)}, contributions: ext${index} },`,
    ),
    "]);",
    "",
  ];
  return lines.join("\n");
}

/** @param {ReturnType<typeof scanExtensions>} entries */
export function emitServer(entries) {
  const withServer = entries.filter((entry) => entry.server !== null);
  const lines = [
    HEADER,
    'import { buildServerRegistry } from "~/registry";',
    ...withServer.map(
      (entry, index) =>
        `import { contributions as ext${index} } from "~/extensions/${entry.id}/${moduleName(entry.server)}";`,
    ),
    "",
    `export const PRESENT_EXTENSIONS: readonly string[] = ${JSON.stringify(entries.map((entry) => entry.id))};`,
    "",
    "export const SERVER_REGISTRY = buildServerRegistry([",
    ...withServer.map(
      (entry, index) =>
        `  { id: ${JSON.stringify(entry.id)}, contributions: ext${index} },`,
    ),
    "]);",
    "",
  ];
  return lines.join("\n");
}

/** @param {string | null} file */
function moduleName(file) {
  return (
    (file ?? "")
      .split(/[\\/]/u)
      .pop()
      ?.replace(/\.tsx?$/u, "") ?? ""
  );
}

/**
 * Scans and writes both generated modules under `src/`, touching a file only
 * when its text changed so a watcher does not loop on its own output.
 * @param {string} root
 */
export function writeRegistry(root) {
  const entries = scanExtensions(root);
  const written = [];
  for (const [file, text] of [
    [join(root, "src", "registry.gen.ts"), emitClient(entries)],
    [join(root, "src", "registry.server.gen.ts"), emitServer(entries)],
  ]) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current !== text) {
      writeFileSync(file, text);
      written.push(file);
    }
  }
  return { entries, written };
}
