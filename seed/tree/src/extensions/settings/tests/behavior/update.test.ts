import { describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { kernelAccounts } from "~/server/kernel/accounts";
import { kernelUpdate } from "~/server/kernel/update";
import { withRequestContext } from "~/server/request-context";
import { readSession } from "~/server/session";

/**
 * The update surface's server side against a real kernel: the session names
 * the owner; the kernel answers the installed release, the check, the
 * updater — absent in the harness, which mounts none — and nothing pending;
 * a request is refused while the updater is absent and for a malformed
 * version, each with the kernel's code; a person who is not the owner is
 * refused `forbidden` and is not the owner on their session. Skips without
 * the kernel harness, which sets `CALLIOPA_KERNEL_SESSION`. BO_0223_015
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return (process.env["CALLIOPA_KERNEL_SESSION"] ?? "") !== "";
  } catch {
    return false;
  }
})();

describe.skipIf(!configured)("the update, through the kernel as the signed-in person", () => {
  it("Given the owner's session, Then the session says so and the kernel answers the release, the check and the updater", async () => {
    const me = await readSession();
    expect(me?.owner).toBe(true);
    const view = await kernelUpdate.read();
    expect(typeof view.release).toBe("string");
    expect(view.updateCheck).toBe(true);
    expect(view.updater.state).toBe("absent");
    expect(view.pending).toBeNull();
  });

  it("Given no updater on the host, Then a request is refused as absent, and a malformed version before that", async () => {
    await expect(kernelUpdate.start("0.4.0")).rejects.toMatchObject({ status: 409, code: "updater_absent" });
    await expect(kernelUpdate.start("v0.4.0")).rejects.toMatchObject({ status: 400, code: "version_invalid" });
    await expect(kernelUpdate.proposal()).rejects.toMatchObject({ status: 404, code: "no_pending_update" });
    // The owner's OK with nothing staged: the kernel names nothing to accept. BO_0241_006
    await expect(kernelUpdate.accept()).rejects.toMatchObject({ status: 404, code: "no_pending_update" });
  });

  it("Given a person who is not the owner, Then their session says so and every update call is forbidden", async () => {
    const name = `upd-${Date.now().toString(36)}`;
    await kernelAccounts.create({ name, class: "agent", password: "upd's own long password" });
    const signedIn = await fetch(`${readGraphEnv().kernelUrl}/__kernel/session/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, password: "upd's own long password" }),
    });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.get("set-cookie")?.match(/calliopa_session=([^;]+)/)?.[1] ?? "";
    const asUpd = <T>(run: () => Promise<T>): Promise<T> => withRequestContext(`calliopa_session=${cookie}`, run);

    expect((await asUpd(readSession))?.owner).toBe(false);
    await expect(asUpd(() => kernelUpdate.read())).rejects.toMatchObject({ status: 403, code: "forbidden" });
    await expect(asUpd(() => kernelUpdate.start("0.4.0"))).rejects.toMatchObject({ status: 403, code: "forbidden" });
    await expect(asUpd(() => kernelUpdate.promote())).rejects.toMatchObject({ status: 403, code: "forbidden" });
    await expect(asUpd(() => kernelUpdate.accept())).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });
});
