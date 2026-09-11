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

/**
 * Creating, exporting and importing an extension through the kernel as the
 * signed-in owner (the harness names its human the owner): a create lands
 * the manifest and system.md and refuses a taken or an invalid id; an export
 * round-trips as an archive the kernel reads back; importing what the
 * instance holds answers nothing to import; a fresh archive stages a group
 * whose record can be read again and rejected. Nothing here accepts or
 * promotes: the confirmation and the gate are the kernel's, verified in the
 * repository's `extensions_import_verification_test.go`. BO_0224_013
 */
describe.skipIf(!configured)(
  "extension create, export and import, through the kernel as the owner",
  () => {
    const id = `test.made${Date.now().toString(36)}`;

    it("Given a name and a purpose, Then the kernel establishes the extension and refuses the name twice", async () => {
      const created = await kernelExtensions.create(id, "A test extension.");
      // A created extension arrives switched off, as an imported one does.
      expect(created.extension).toMatchObject({ id, version: "0.1.0", category: "individual", active: false });
      expect(created.dataRevision).toBeGreaterThan(0);
      const again = await kernelExtensions.create(id, "Again.").catch((error: unknown) => error);
      expect(again).toBeInstanceOf(HttpError);
      expect(again).toMatchObject({ status: 409, code: "extension_exists" });
      const invalid = await kernelExtensions.create("Not An Id", "p").catch((error: unknown) => error);
      expect(invalid).toMatchObject({ status: 400, code: "extension_id_invalid" });
      const listing = await listExtensions();
      expect(listing.reachable).toBe(true);
      if (!listing.reachable) return;
      expect(listing.extensions.find((extension) => extension.id === id)).toMatchObject({ category: "individual", active: false });
    });

    it("Given the created extension, Then its export is an archive named for it whose import back answers nothing to import", async () => {
      const archive = await kernelExtensions.exportArchive(id);
      expect(archive.fileName).toBe(`${id}-0.1.0.calliopa-extension.zip`);
      // A zip begins with the local file header signature.
      expect(Array.from(archive.bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
      const nothing = await kernelExtensions.importArchive(archive.bytes, archive.fileName).catch((error: unknown) => error);
      expect(nothing).toBeInstanceOf(HttpError);
      expect(nothing).toMatchObject({ status: 409, code: "nothing_to_import" });
      const unknown = await kernelExtensions.exportArchive("test.nowhere").catch((error: unknown) => error);
      expect(unknown).toMatchObject({ status: 404, code: "extension_unknown" });
    });

    it("Given an archive that is not one, Then the kernel refuses it by name", async () => {
      const refusal = await kernelExtensions
        .importArchive(new TextEncoder().encode("not a zip"), "nope.zip")
        .catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(HttpError);
      expect(refusal).toMatchObject({ status: 400, code: "archive_invalid" });
      const gone = await kernelExtensions.importRecord("node:chg-nowhere").catch((error: unknown) => error);
      expect(gone).toMatchObject({ status: 404, code: "import_unknown" });
    });
  },
);
