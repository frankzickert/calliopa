import { spawn } from "node:child_process";

/**
 * The tree's serve entry under the kernel. The kernel hands the tree the
 * two addresses it needs — CCGW at CALLIOPA_CCGW_URL and the kernel's own
 * public port at CALLIOPA_KERNEL_URL — and the port to listen on. Since
 * BO_0207_016 the shell keeps no store: nothing is assembled from secret
 * files, nothing is migrated, and the promotion gate's serve probe
 * (CALLIOPA_SERVE_PROBE=1) has nothing to skip. With --dev it starts the
 * Vite SSR dev server instead. BO_0200_011
 */
const env = process.env;
const dev = process.argv.includes("--dev");
const port = env.PORT ?? "4300";

if (env.CALLIOPA_SERVE_PROBE) {
  process.stdout.write("serve probe: nothing to skip; the shell keeps no store\n");
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
