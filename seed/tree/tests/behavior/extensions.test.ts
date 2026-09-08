import { describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { HttpError } from "~/server/http-error";
import { kernelExtensions } from "~/server/kernel/extensions";
import { listExtensions } from "~/server/extensions";

/**
 * The extension activation surface's server side against a real kernel: the
 * listing names what the graph holds with the shell marked required and
 * active, a required extension refuses to be switched off with the kernel's
 * own code before anything is written, and a no-op change writes and promotes
 * nothing. Nothing here promotes: the rebuild is the kernel's, verified in
 * the repository's `extensions_verification_test.go`. Skips without the
 * kernel harness, which sets `CALLIOPA_KERNEL_SESSION`. BO_0218_009 BO_0218_011
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return (process.env["CALLIOPA_KERNEL_SESSION"] ?? "") !== "";
  } catch {
    return false;
  }
})();

describe.skipIf(!configured)(
  "extension activation, through the kernel as the signed-in person",
  () => {
    it("Given the shell, Then the listing marks it required and active, following the release pin", async () => {
      const listing = await kernelExtensions.list();
      const shell = listing.extensions.find(
        (extension) => extension.id === "ui.shell",
      );
      expect(shell).toBeDefined();
      expect(shell).toMatchObject({
        required: true,
        active: true,
        pinned: false,
      });
      expect(listing.required).toContain("ui.shell");
      expect(listing.canChange).toBe(true);
      expect(shell?.versions.length).toBeGreaterThan(0);
      expect(shell?.versions[0]?.current).toBe(true);
    });

    it("Given a required extension, Then switching it off is refused with the kernel's code and nothing is written", async () => {
      const before = (await kernelExtensions.list()).stateWrittenAt;
      const refusal = await kernelExtensions
        .setActive("ui.shell", false)
        .catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(HttpError);
      expect(refusal).toMatchObject({
        status: 409,
        code: "extension_required",
      });
      expect((await kernelExtensions.list()).stateWrittenAt).toBe(before);
    });

    it("Given an extension already in the requested state, Then nothing is written and nothing promotes", async () => {
      const change = await kernelExtensions.setActive("ui.shell", true);
      expect(change).toMatchObject({
        id: "ui.shell",
        active: true,
        changed: false,
      });
      expect(change.promotion).toBeUndefined();
    });

    it("Given the library's listing, Then every row says whether it is active and pinned", async () => {
      const listing = await listExtensions();
      expect(listing.reachable, JSON.stringify(listing)).toBe(true);
      if (!listing.reachable) return;
      const shell = listing.extensions.find(
        (extension) => extension.id === "ui.shell",
      );
      expect(shell).toMatchObject({ active: true, pinned: false });
    });
  },
);
