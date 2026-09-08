import { describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { kernelAccounts } from "~/server/kernel/accounts";
import { withRequestContext } from "~/server/request-context";
import { readSession } from "~/server/session";

/**
 * The people surface's server side against a real kernel: the session names
 * the fixture human, who is the owner, so the list answers; a person is
 * created, moved between the states and the classes, given a password by the
 * owner without the current one, and the owner's own password is changed with
 * the current one and refused with a wrong one. Every rule is the core's;
 * this proves the calls reach it as the person and its refusals come back
 * with their codes. Skips without the kernel harness, which sets
 * `CALLIOPA_KERNEL_SESSION` (`BO_0208_010`). BO_0209_008
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return (process.env["CALLIOPA_KERNEL_SESSION"] ?? "") !== "";
  } catch {
    return false;
  }
})();

describe.skipIf(!configured)("people, through the kernel as the signed-in person", () => {
  const name = `pip-${Date.now().toString(36)}`;

  it("Given the owner's session, Then the list names the humans and the agents by kind with the owner marked", async () => {
    const me = await readSession();
    expect(me).not.toBeNull();
    const listing = await kernelAccounts.list();
    const mine = listing.principals.find((p) => p.name === me?.name);
    expect(mine?.owner).toBe(true);
    expect(mine?.kind).toBe("human");
    expect(mine?.lastActiveAt).toBeDefined();
    expect(listing.seats).toBeGreaterThan(0);
  });

  it("Given a new person, Then they are created proposing only, moved between the states and the classes, and given a password by the owner", async () => {
    const created = await kernelAccounts.create({ name, class: "agent", password: "pip's own long password" });
    expect(created).toMatchObject({ name, kind: "human", class: "agent", state: "active", owner: false });
    expect((await kernelAccounts.list()).principals.some((p) => p.name === name)).toBe(true);

    expect((await kernelAccounts.setState(name, "suspended")).state).toBe("suspended");
    expect((await kernelAccounts.setState(name, "active")).state).toBe("active");
    // The harness registry has seats to spare, so the move is admitted; on a
    // one-seat instance the core answers `unlicensed` instead.
    expect((await kernelAccounts.setClass(name, "human")).class).toBe("human");
    expect((await kernelAccounts.setClass(name, "agent")).class).toBe("agent");

    // The owner's path: no current password, the recovery verb's shape.
    await expect(kernelAccounts.setPassword(name, "set by the owner")).resolves.toMatchObject({ otherSessionsRevoked: 0 });
  });

  it("Given the person's own session, Then the list is forbidden, a wrong current password is refused with its code, and the right one is accepted", async () => {
    // The person signs in through the kernel, and the calls below run in a
    // request context carrying that session rather than the harness's.
    const signedIn = await fetch(`${readGraphEnv().kernelUrl}/__kernel/session/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, password: "set by the owner" }),
    });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.get("set-cookie")?.match(/calliopa_session=([^;]+)/)?.[1] ?? "";
    expect(cookie).not.toBe("");
    const asPip = <T>(run: () => Promise<T>): Promise<T> => withRequestContext(`calliopa_session=${cookie}`, run);

    expect((await asPip(readSession))?.name).toBe(name);
    await expect(asPip(() => kernelAccounts.list())).rejects.toMatchObject({ status: 403, code: "forbidden" });
    await expect(
      asPip(() => kernelAccounts.setPassword(name, "a password that must not land", "not the current one")),
    ).rejects.toMatchObject({ status: 401, code: "unauthenticated" });
    await expect(
      asPip(() => kernelAccounts.setPassword(name, "pip's newer password", "set by the owner")),
    ).resolves.toMatchObject({ otherSessionsRevoked: 0 });
    // Another's password is nobody's but the owner's.
    const owner = (await readSession())?.name ?? "";
    await expect(
      asPip(() => kernelAccounts.setPassword(owner, "pip takes over", "pip's newer password")),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("Given the owner again, Then the person is retired and a name nobody holds is refused with its code", async () => {
    expect((await kernelAccounts.setState(name, "retired")).state).toBe("retired");
    await expect(kernelAccounts.setState("nobody-at-all", "suspended")).rejects.toMatchObject({
      status: 404,
      code: "unknown_principal",
    });
  });
});
