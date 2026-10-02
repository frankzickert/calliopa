import { resolve } from "node:path";

import { extendConfig } from "@builder.io/qwik-city/vite";

import baseConfig from "../../vite.config";

/**
 * The device build's in-page server: the same tree's server half, bundled for
 * the WebView with `#port` answered over the native bridge and `#host` the
 * native host's own definitions, which `build:device` names in
 * `CALLIOPA_HOST`. The client bundle is the instance's, built first.
 * CA_0076_002
 */
const host = process.env["CALLIOPA_HOST"] ?? "";

export default extendConfig(baseConfig, () => ({
  resolve: {
    conditions: ["browser"],
    alias: {
      "#port": resolve(import.meta.dirname, "port.ts"),
      "#host": resolve(host, "src", "index.ts"),
    },
  },
  ssr: { target: "webworker" as const, noExternal: true },
  // Bundled rather than imported at run time, Qwik's server code reads
  // import.meta.env, which a server build otherwise leaves to the runtime;
  // DEV read as true there drops the build base from the preloader.
  define: { "import.meta.env.DEV": "false" },
  publicDir: false as const,
  build: {
    ssr: true,
    outDir: "dist/device",
    emptyOutDir: true,
    rollupOptions: {
      input: [resolve(import.meta.dirname, "entry.ts")],
      output: { format: "es" as const },
    },
  },
}));
