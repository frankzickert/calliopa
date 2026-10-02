// build:device — the shell for the apps' WebView, into dist/, which the native
// host's webDir takes (calliopa-bootstrap's mobile/Makefile, shell-device).
// It typechecks the device adapter against the host's own definitions, builds
// the instance's client bundle, then the in-page server, and lists the host's
// files beside them. `build`, which the kernel runs, is untouched. CA_0076_002
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const tree = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const host = process.env.CALLIOPA_HOST ?? "";

function refuse(reason) {
  console.error(`build:device: ${reason}`);
  process.exit(1);
}

if (host === "") {
  refuse(
    "CALLIOPA_HOST names no native host; it is calliopa-bootstrap's mobile/host, with its pnpm install done.",
  );
}
if (!existsSync(join(host, "src", "index.ts")))
  refuse(`${host} holds no src/index.ts; it is not the native host.`);
if (!existsSync(join(host, "node_modules", "@capacitor", "core"))) {
  refuse(
    `${host} has no node_modules/@capacitor/core: run pnpm install --frozen-lockfile there first.`,
  );
}

function run(command, args, env = {}) {
  const done = spawnSync(command, args, {
    cwd: tree,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (done.status !== 0) refuse(`${command} ${args.join(" ")} failed`);
}

// The device adapter against the definitions the host implements: #host is
// the host's src/index.ts, so the page and the plugins share one definition.
const cache = join(tree, "node_modules", ".cache", "calliopa-device");
mkdirSync(cache, { recursive: true });
writeFileSync(
  join(cache, "tsconfig.json"),
  JSON.stringify({
    extends: join(tree, "tsconfig.json"),
    compilerOptions: {
      incremental: false,
      allowImportingTsExtensions: true,
      paths: {
        "~/*": [join(tree, "src", "*")],
        "#port": [join(tree, "adapters", "device", "port.ts")],
        "#host": [join(host, "src", "index.ts")],
      },
    },
    include: [join(tree, "src"), join(tree, "adapters", "device")],
    exclude: [join(tree, "node_modules")],
  }),
);
run("node", ["scripts/gen-registry.mjs"]);
run("pnpm", ["exec", "tsc", "-p", join(cache, "tsconfig.json")]);

// The instance's client bundle, then the in-page server over it.
run("pnpm", ["exec", "vite", "build"]);
run("pnpm", ["exec", "vite", "build", "-c", "adapters/device/vite.config.ts"], {
  CALLIOPA_HOST: host,
});

// dist/ is a build output, which a commit never sweeps in.
const out = join(tree, "dist");
cpSync(join(tree, "adapters", "device", "index.html"), join(out, "index.html"));

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const listed = files(out).map(
  (path) => `/${relative(out, path).split(sep).join("/")}`,
);
listed.push("/device/files.json");
writeFileSync(join(out, "device", "files.json"), JSON.stringify(listed.sort()));
rmSync(cache, { recursive: true, force: true });
console.log(`build:device: ${listed.length} files in ${relative(tree, out)}/`);
