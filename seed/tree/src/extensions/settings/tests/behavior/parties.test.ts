import { describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { listConnections, proveConnection } from "../../server/connections";

/**
 * The party roster in the kernel's secret store, against a real kernel:
 * `CALLIOPA_KERNEL_URL` names it. Without it the suite skips; the
 * repository's kernel harness provides it over a scratch kernel with a secret
 * store mounted. The settings extension's own behavior suite, run only while
 * the extension is present in the tree. A channel's row is `publishing`'s to
 * prove, in its `tests/behavior/roster.test.ts`: this extension imports
 * nothing from `publishing`, so an instance without it still builds.
 * `BO_0207_013` `BO_0202_011` CA_0051_001
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!configured)("party configuration in the kernel's secret store", () => {
  it("Given every party, Then the listing names them all, unconfigured until something is stored", async () => {
    const rows = await listConnections();
    // The four parties this extension contributes; a channel another
    // extension contributes lists beside them when that extension is present.
    expect(rows.map((row) => row.party)).toEqual(
      expect.arrayContaining(["claude-code", "codex", "hermes", "honcho"]),
    );
    expect(rows.find((row) => row.party === "honcho")?.keySet).toBe(false);
  });

  it("Given a party with no key, Then proving it is refused rather than reported as failing", async () => {
    await expect(proveConnection("honcho")).rejects.toMatchObject({ status: 409 });
  });
});
