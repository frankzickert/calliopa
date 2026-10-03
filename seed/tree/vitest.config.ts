import { qwikVite } from "@builder.io/qwik/optimizer";
import tsconfigPaths from "vite-tsconfig-paths";
import { registryPlugin } from "./scripts/registry-plugin.mjs";
import { defineConfig } from "vitest/config";

// The unit and behavior projects travel with the tree; the browser,
// integration and publish suites need Playwright or a running stack and stay
// in the calliopa-app repository. BO_0200_011
export default defineConfig({
  // The optimizer, so a test may import a module holding components — the
  // generated registry does — and the registry plugin, so the modules exist. BO_0202_011
  plugins: [registryPlugin(), qwikVite(), tsconfigPaths({ root: "." })],
  test: {
    environment: "node",
    // Half the cores: with a worker on every core the editor's timing
    // scenarios lost to contention, a different one each run, and the run
    // took twice as long. An editor mounted in the render harness, or a
    // citation style loaded into citeproc, still takes seconds under load,
    // so a test has twenty before it times out. CA_0079_001
    maxWorkers: "50%",
    testTimeout: 20000,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/extensions/*/tests/**"],
        },
      },
      {
        // A kind's environment-gated gate, reaching a real destination; never
        // run by `check`. PU_0003_007
        extends: true,
        test: {
          name: "publish",
          include: ["src/extensions/*/tests/publish/**/*.test.{ts,mjs}"],
        },
      },
      {
        extends: true,
        test: {
          name: "behavior",
          // An extension's own behavior suite lives beside it and runs only
          // while the extension is present. BO_0202_011
          include: [
            "tests/behavior/**/*.test.{ts,mjs}",
            "src/extensions/*/tests/behavior/**/*.test.{ts,mjs}",
          ],
        },
      },
    ],
  },
});
