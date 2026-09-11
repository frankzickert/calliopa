import { describe, expect, it } from "vitest";

import { forwardedHeaders, withRequestContext } from "./request-context";

/**
 * A call on the browser's behalf carries its session cookie and the host it
 * reached Calliopa at, so the kernel names a parked action's confirmation
 * link after that host (`ui-kernel.md`, `BO_0241_003`). BO_0241_006
 */
describe("forwardedHeaders", () => {
  it("carries the cookie and the browser's host inside a request", async () => {
    const headers = await withRequestContext("calliopa_session=s1", async () => forwardedHeaders(), "calliopa.lan:8090");
    expect(headers).toEqual({ cookie: "calliopa_session=s1", "x-forwarded-host": "calliopa.lan:8090" });
  });

  it("carries no host a request did not bring", async () => {
    const headers = await withRequestContext("calliopa_session=s1", async () => forwardedHeaders());
    expect(headers).toEqual({ cookie: "calliopa_session=s1" });
  });
});
