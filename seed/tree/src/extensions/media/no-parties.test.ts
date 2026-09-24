import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * This extension contributes no party, and that is a rule rather than an
 * omission (`BO_0273_032`).
 *
 * A `credential: "status"` party is an *agent runtime* to the settings
 * extension: `withStatus` reads its state from what the agent reported, which
 * the hermes broker writes for `codex` and `claude-code` alone. A generator
 * listed there reads *The agent has not reported on this runtime* forever,
 * whatever its real state — which is exactly what happened when these were
 * first contributed. The generators' sign-in is this extension's own
 * Generators section, which reads the media service.
 *
 * The source is read rather than imported: the server contributions pull in
 * Qwik City, which the unit project does not load.
 */
describe("what this extension contributes", () => {
  const source = readFileSync(new URL("./contributions.server.ts", import.meta.url), "utf8");

  it("contributes no party, so no generator is read as an agent runtime", () => {
    expect(source).not.toMatch(/^\s*parties:/m);
  });

  it("serves the sign-in itself", () => {
    expect(source).toContain('path: "sign-in"');
    expect(source).toContain('path: "services"');
  });
});
