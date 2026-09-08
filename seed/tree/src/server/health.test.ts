import { describe, expect, it } from "vitest";

import { healthResponse, probe } from "./health";

const reachable = { reachable: true } as const;

describe("health reporting", () => {
  it("Given the graph and the kernel are reachable, When health is reported, Then it answers 200 and ok", () => {
    const response = healthResponse(reachable, reachable);

    expect(response.statusCode).toBe(200);
    expect(response.report.status).toBe("ok");
    expect(response.report.ccgw).toEqual(reachable);
    expect(response.report.kernel).toEqual(reachable);
  });

  it("Given CCGW is unreachable, When health is reported, Then it answers 503 with the failure", () => {
    const response = healthResponse({ reachable: false, error: "connection refused" }, reachable);

    expect(response.statusCode).toBe(503);
    expect(response.report.status).toBe("unhealthy");
    expect(response.report.ccgw).toEqual({ reachable: false, error: "connection refused" });
  });

  it("Given the kernel is unreachable, When health is reported, Then it answers 503 with the failure", () => {
    const response = healthResponse(reachable, { reachable: false, error: "503 from the kernel" });

    expect(response.statusCode).toBe(503);
    expect(response.report.kernel).toEqual({ reachable: false, error: "503 from the kernel" });
  });

  it("Given a probe that throws, When it is run, Then the state carries the message rather than the exception", async () => {
    expect(await probe(() => Promise.reject(new Error("gone"))).then((state) => state)).toEqual({
      reachable: false,
      error: "gone",
    });
    expect(await probe(() => Promise.resolve("fine"))).toEqual({ reachable: true });
  });
});
