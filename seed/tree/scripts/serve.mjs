import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

import { applyMigrations } from "./lib/migrations.mjs";

/**
 * The tree's serve entry under the kernel. The kernel passes its own
 * environment through, in which every secret is a file; the shell's env
 * loader reads plain variables. This assembles the plain variables from the
 * file forms, applies the tree's pending migrations, and starts the built
 * server on the port the kernel supplies. With --dev it starts the Vite SSR
 * dev server instead. BO_0200_011
 *
 * Under the promotion gate's serve probe (CALLIOPA_SERVE_PROBE=1) nothing is
 * migrated: a refused candidate must leave the database it would have served
 * untouched. BO_0200_002
 */
const env = process.env;

function fileValue(name) {
  const path = env[name];
  if (!path) {
    return undefined;
  }
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return undefined;
  }
}

function assemble() {
  if (!env.CALLIOPA_DATABASE_URL && env.CALLIOPA_APP_DB_HOST) {
    const password = fileValue("CALLIOPA_APP_DB_PASSWORD_FILE") ?? env.CALLIOPA_APP_DB_PASSWORD ?? "";
    const user = env.CALLIOPA_APP_DB_USER ?? "calliopa";
    const port = env.CALLIOPA_APP_DB_PORT ?? "5432";
    const name = env.CALLIOPA_APP_DB_NAME ?? "calliopa_app";
    env.CALLIOPA_DATABASE_URL = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${env.CALLIOPA_APP_DB_HOST}:${port}/${name}?sslmode=disable`;
  }
  const fromFile = [
    ["CALLIOPA_GARAGE_ACCESS_KEY_ID", "CALLIOPA_GARAGE_KEY_ID_FILE"],
    ["CALLIOPA_GARAGE_SECRET_ACCESS_KEY", "CALLIOPA_GARAGE_KEY_SECRET_FILE"],
    ["CALLIOPA_SECRETS_KEY", "CALLIOPA_SECRETS_KEY_PATH"],
    ["CALLIOPA_HERMES_API_KEY", "CALLIOPA_HERMES_BEARER_FILE"],
  ];
  for (const [name, file] of fromFile) {
    if (!env[name]) {
      const value = fileValue(file);
      if (value !== undefined) {
        env[name] = value;
      }
    }
  }
}

assemble();

const root = new URL("../", import.meta.url).pathname;
const dev = process.argv.includes("--dev");
const port = env.PORT ?? "4300";

if (env.CALLIOPA_DATABASE_URL && !env.CALLIOPA_SERVE_PROBE) {
  const count = await applyMigrations(root, env.CALLIOPA_DATABASE_URL, (line) =>
    process.stdout.write(`${line}\n`),
  );
  process.stdout.write(
    count === 0 ? "no pending migrations\n" : `${count} migration(s) applied\n`,
  );
} else if (env.CALLIOPA_SERVE_PROBE) {
  process.stdout.write("serve probe: migrations skipped\n");
}

if (dev) {
  const child = spawn(
    "pnpm",
    ["exec", "vite", "--mode", "ssr", "--host", "0.0.0.0", "--port", port],
    { stdio: "inherit", env },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  env.PORT = port;
  await import("../server/entry.node-server.js");
}
