import { afterEach, describe, expect, it, vi } from "vitest";

import { withRequestContext, withRunGrant } from "../request-context";
import { call } from "./client";

/**
 * A kernel call made while answering a run's tool presents the run's grant,
 * since no browser asked and there is no cookie to forward; a call on a
 * browser's behalf carries its cookie and no grant (`calliopa-bootstrap`'s
 * `BO_0312_063`).
 */
describe("call", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sent = async (run: () => Promise<Response>) => {
    vi.stubEnv("CALLIOPA_CCGW_URL", "http://ccgw.test");
    vi.stubEnv("CALLIOPA_KERNEL_URL", "http://kernel.test");
    vi.stubEnv("CALLIOPA_KERNEL_SESSION", "");
    const headers: Headers[] = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      headers.push(new Headers(init?.headers));
      return new Response("{}", { status: 200 });
    });
    await run();
    return headers[0] ?? new Headers();
  };

  it("presents the run's grant inside a tool, with no cookie", async () => {
    const headers = await sent(() => withRunGrant("grant-1", () => call("/__kernel/media/services", { method: "GET" })));
    expect(headers.get("x-calliopa-run-grant")).toBe("grant-1");
    expect(headers.get("cookie")).toBeNull();
  });

  it("carries the browser's cookie and no grant on its behalf", async () => {
    const headers = await sent(() => withRequestContext("calliopa_session_0123456789abcdef=s1", () => call("/__kernel/media/services", { method: "GET" })));
    expect(headers.get("cookie")).toBe("calliopa_session_0123456789abcdef=s1");
    expect(headers.get("x-calliopa-run-grant")).toBeNull();
  });
});
