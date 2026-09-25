import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatSource } from "./format";

/**
 * The format hop as the model makes it (`BO_0296_015`): the route called with
 * the language and the source, its rewrite carried through, and every failure
 * of the hop — a refusal, a timeout, an unreachable kernel, an answer that is
 * not what was promised, an answer of *unchanged* — writing the source
 * exactly as typed. The route is stubbed, since what is proven here is what
 * the model does with each answer; the route itself is the kernel's and is
 * proven there.
 */
const SOURCE = "def f( x ):\n  return x+1\n";
const TIDY = "def f(x):\n    return x + 1\n";

const answering = (status: number, body: unknown, delay = 0) =>
  vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    if (delay > 0) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });

beforeEach(() => {
  process.env["CALLIOPA_CCGW_URL"] = process.env["CALLIOPA_CCGW_URL"] ?? "http://ccgw.test";
  process.env["CALLIOPA_KERNEL_URL"] = process.env["CALLIOPA_KERNEL_URL"] ?? "http://kernel.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatting a settled edit through the kernel", () => {
  it("posts the language and the source to the format route and carries the rewrite back", async () => {
    const route = answering(200, { source: TIDY, formatted: true });
    vi.stubGlobal("fetch", route);
    expect(await formatSource(SOURCE, "python")).toBe(TIDY);
    expect(route).toHaveBeenCalledTimes(1);
    const [url, init] = route.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/__kernel\/code\/format$/u);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ language: "python", source: SOURCE });
  });

  it("writes the source as typed when the formatter answers unchanged", async () => {
    vi.stubGlobal("fetch", answering(200, { source: SOURCE, formatted: false, reason: "does not parse" }));
    expect(await formatSource(SOURCE, "python")).toBe(SOURCE);
  });

  it("writes the source as typed on a refusal, and on an answer that is not what was promised", async () => {
    vi.stubGlobal("fetch", answering(401, { status: "sign_in_required" }));
    expect(await formatSource(SOURCE, "python")).toBe(SOURCE);
    vi.stubGlobal("fetch", answering(404, { status: "not_found" }));
    expect(await formatSource(SOURCE, "python")).toBe(SOURCE);
    vi.stubGlobal("fetch", answering(200, "not json at all"));
    expect(await formatSource(SOURCE, "python")).toBe(SOURCE);
    vi.stubGlobal("fetch", answering(200, { formatted: true }));
    expect(await formatSource(SOURCE, "python")).toBe(SOURCE);
    vi.stubGlobal("fetch", answering(200, [1, 2]));
    expect(await formatSource(SOURCE, "python")).toBe(SOURCE);
  });

  it("writes the source as typed when the kernel cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect(await formatSource(SOURCE, "python")).toBe(SOURCE);
  });

  it("writes the source as typed when the formatter does not answer in time", async () => {
    // The wait is the model's own signal on the call, so a short one here
    // proves the same path the twelve-second one takes.
    vi.stubGlobal("fetch", answering(200, { source: TIDY, formatted: true }, 2_000));
    expect(await formatSource(SOURCE, "python", 40)).toBe(SOURCE);
  });

  it("calls nothing for a block with no language or no source", async () => {
    const route = answering(200, { source: TIDY, formatted: true });
    vi.stubGlobal("fetch", route);
    expect(await formatSource(SOURCE, undefined)).toBe(SOURCE);
    expect(await formatSource(SOURCE, "  ")).toBe(SOURCE);
    expect(await formatSource("   ", "python")).toBe("   ");
    expect(route).not.toHaveBeenCalled();
  });
});
