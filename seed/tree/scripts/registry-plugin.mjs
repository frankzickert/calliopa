// The Vite plugin over the registry scan: regenerates both `*.gen.*` modules
// when the config resolves, so a build or the dev server starts from the
// extensions present, and again in watch mode when a manifest or an
// entrypoint appears, changes or goes. A scan error fails the build with its
// name. BO_0202_001
import { writeRegistry } from "./registry.mjs";

const ENTRYPOINT = /[\\/]src[\\/]extensions[\\/][^\\/]+[\\/](manifest\.json|[^\\/]+\.tsx?)$/u;

/** @returns {import("vite").Plugin} */
export function registryPlugin() {
  let root = process.cwd();
  return {
    name: "calliopa-registry",
    configResolved(config) {
      root = config.root;
      writeRegistry(root);
    },
    configureServer(server) {
      const regenerate = (/** @type {string} */ file) => {
        if (!ENTRYPOINT.test(file)) return;
        try {
          writeRegistry(root);
        } catch (error) {
          server.config.logger.error(`registry: ${String(error)}`);
        }
      };
      server.watcher.on("add", regenerate);
      server.watcher.on("unlink", regenerate);
      server.watcher.on("change", regenerate);
    },
  };
}
