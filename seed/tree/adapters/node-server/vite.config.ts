import { nodeServerAdapter } from "@builder.io/qwik-city/adapters/node-server/vite";
import { extendConfig } from "@builder.io/qwik-city/vite";
import type { PluginOption } from "vite";

import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => ({
  build: {
    ssr: true,
    outDir: "server",
    emptyOutDir: true,
    rollupOptions: {
      input: ["src/entry.node-server.ts", "@qwik-city-plan"],
    },
  },
  plugins: [
    nodeServerAdapter({
      name: "node-server",
      ssg: {
        include: [],
        origin: "http://localhost",
        sitemapOutFile: null,
      },
    }) as PluginOption,
  ],
}));
