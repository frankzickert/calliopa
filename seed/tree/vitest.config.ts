import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// The unit and behavior projects travel with the tree; the browser,
// integration and publish suites need Playwright or a running stack and stay
// in the calliopa-app repository. BO_0200_011
export default defineConfig({
  plugins: [tsconfigPaths({ root: "." })],
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "behavior",
          include: ["tests/behavior/**/*.test.{ts,mjs}"],
        },
      },
    ],
  },
});
