// `pnpm gen`: writes src/registry.gen.ts and src/registry.server.gen.ts from
// the extensions present, so a fresh checkout typechecks and tests before
// Vite starts. `prebuild`, `pretypecheck` and `pretest:*` run it. BO_0202_001
import { writeRegistry } from "./registry.mjs";

try {
  const { entries, written } = writeRegistry(process.cwd());
  const ids = entries.map((entry) => entry.id + (entry.client || entry.server ? "" : " (no entrypoint)"));
  console.log(`registry: ${entries.length} extensions (${ids.join(", ")}); ${written.length === 0 ? "unchanged" : `wrote ${written.length}`}`);
} catch (error) {
  const code = error instanceof Error && "code" in error ? String(error.code) : "error";
  console.error(`registry: ${code}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
