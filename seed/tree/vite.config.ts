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
