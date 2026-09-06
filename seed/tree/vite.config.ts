import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { defineConfig, type PluginOption } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => ({
  plugins: [
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
