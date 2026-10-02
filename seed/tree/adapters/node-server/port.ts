import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Port, PortEnvName, Scope } from "../../src/server/port/port";

/**
 * The port on an instance: what the server half has always done, in Node.
 * Every value is read when it is asked for rather than when this module
 * loads, so a suite that stubs the environment or `fetch` sees its own.
 * CA_0074_001
 */

/** Where the agent and the application meet, unless a suite points elsewhere. */
const agentConfigDir = () => process.env["CALLIOPA_AGENT_CONFIG_DIR"] ?? "/var/lib/calliopa/agent-config";

/** An address the kernel hands the tree; absence is an error, never a default. */
function base(name: PortEnvName): string {
  const url = (process.env[name] ?? "").trim();
  if (url === "") throw new Error(`Missing required environment variable: ${name}`);
  return url.replace(/\/+$/u, "");
}

function scope<T>(): Scope<T> {
  const storage = new AsyncLocalStorage<T>();
  return {
    run: (value, call) => storage.run(value, call),
    current: () => storage.getStore(),
  };
}

export const port: Port = {
  env: (name) => process.env[name],
  now: () => new Date(),
  uuid: () => randomUUID(),
  sameSecret: (presented, secret) => {
    const left = Buffer.from(presented);
    const right = Buffer.from(secret);
    return left.length === right.length && timingSafeEqual(left, right);
  },
  scope,
  agentConfig: {
    read: async (path) => {
      try {
        return await readFile(join(agentConfigDir(), path), "utf8");
      } catch {
        return null;
      }
    },
    exists: async (path) => {
      try {
        await access(join(agentConfigDir(), path));
        return true;
      } catch {
        return false;
      }
    },
    replace: async (path, text, mode) => {
      const target = join(agentConfigDir(), path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(`${target}.tmp`, text, { mode });
      await rename(`${target}.tmp`, target);
    },
  },
  gateway: async (path, init) => fetch(`${base("CALLIOPA_CCGW_URL")}${path}`, init),
  kernel: async (path, init) => fetch(`${base("CALLIOPA_KERNEL_URL")}${path}`, init),
  fetch: (url, init) => fetch(url, init),
};
