import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { defineConfig, type PluginOption } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { registryPlugin } from "./scripts/registry-plugin.mjs";

export default defineConfig(() => ({
  plugins: [
    // Regenerates src/registry.gen.ts and src/registry.server.gen.ts from the
    // extensions present before Qwik City reads the tree. BO_0202_001
    registryPlugin(),
    qwikCity({ trailingSlash: false }),
    qwikVite() as PluginOption,
    tsconfigPaths({ root: "." }),
  ],
  // A production page inlines each derived signal's function, so a prop a
  // component was handed from a loader reads its value once the page
  // resumes; Qwik's optimizer serializes them only in development unless
  // told otherwise. CA_0077_002
  define: { "globalThis.qSerialize": true },
  server: {
    host: "0.0.0.0",
    port: 4300,
    watch: { usePolling: true, interval: 300 },
    allowedHosts: true as const,
    headers: { "Cache-Control": "public, max-age=0" },
  },
  preview: {
    host: "0.0.0.0",
    port: 4300,
    allowedHosts: true as const,
  },
}));
