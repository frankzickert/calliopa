import { describe, expect, it } from "vitest";

import config from "../../vite.config";

/**
 * A production page resumes with every prop a component was handed from a
 * loader: Qwik's optimizer serializes a derived signal's function only in
 * development unless the configuration says otherwise, and without it a
 * resumed prop reads null — the shell's process poll failed on
 * `workspace.id` and the library's buttons on `workspace.layout`, so no
 * document could be opened (`docs/system/foundation/device.md`). The build
 * itself is read in a browser; this keeps the setting from going. CA_0077_003
 */
describe("props handed from a loader in a production build", () => {
  it("Given the tree's build configuration, Then derived signals are serialized in production too", () => {
    const resolved = typeof config === "function" ? config({ command: "build", mode: "production" }) : config;
    expect((resolved as { define?: Record<string, unknown> }).define?.["globalThis.qSerialize"]).toBe(true);
  });
});
