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
