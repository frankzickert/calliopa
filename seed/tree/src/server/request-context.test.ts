import { describe, expect, it } from "vitest";

import { forwardedCookie, forwardedGrant, forwardedHeaders, withRequestContext, withRunGrant } from "./request-context";

/**
 * A call on the browser's behalf carries its session cookie and the host it
 * reached Calliopa at, so the kernel names a parked action's confirmation
 * link after that host (`ui-kernel.md`, `BO_0241_003`). BO_0241_006
 */
describe("forwardedHeaders", () => {
  it("carries the cookie and the browser's host inside a request", async () => {
    const headers = await withRequestContext("calliopa_session_0123456789abcdef=s1", async () => forwardedHeaders(), "calliopa.lan:8090");
    expect(headers).toEqual({ cookie: "calliopa_session_0123456789abcdef=s1", "x-forwarded-host": "calliopa.lan:8090" });
  });

  it("carries no host a request did not bring", async () => {
    const headers = await withRequestContext("calliopa_session_0123456789abcdef=s1", async () => forwardedHeaders());
    expect(headers).toEqual({ cookie: "calliopa_session_0123456789abcdef=s1" });
  });
});

/**
 * Outside a request the harness's session travels as the whole cookie pair
 * it hands over, since the kernel names its cookie for its own instance and
 * the shell never needs to know that name. BO_0307_004
 */
describe("forwardedCookie", () => {
  it("forwards the harness's cookie pair as given outside a request", () => {
    const before = process.env["CALLIOPA_KERNEL_SESSION"];
    process.env["CALLIOPA_KERNEL_SESSION"] = "calliopa_session_0123456789abcdef=s2";
    try {
      expect(forwardedCookie()).toBe("calliopa_session_0123456789abcdef=s2");
    } finally {
      if (before === undefined) delete process.env["CALLIOPA_KERNEL_SESSION"];
      else process.env["CALLIOPA_KERNEL_SESSION"] = before;
    }
  });
});

/**
 * A tool's callback holds no person's session: the kernel hands it a run's
 * grant instead, and every kernel call made while answering presents it
 * (`calliopa-bootstrap`'s `BO_0312_063`).
 */
describe("forwardedGrant", () => {
  it("is the grant a tool runs under, and nothing outside it", async () => {
    expect(await withRunGrant("grant-1", async () => forwardedGrant())).toBe("grant-1");
    expect(await withRunGrant("", async () => forwardedGrant())).toBeUndefined();
    expect(forwardedGrant()).toBeUndefined();
  });
});
