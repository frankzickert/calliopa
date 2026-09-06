import { describe, expect, it } from "vitest";

import { healthResponse, probe } from "./health";

const reachable = { reachable: true } as const;

describe("health reporting", () => {
  it("Given both dependencies are reachable, When health is reported, Then it answers 200 and ok", () => {
    const response = healthResponse(reachable, reachable);

    expect(response.statusCode).toBe(200);
    expect(response.report.status).toBe("ok");
    expect(response.report.postgres).toEqual(reachable);
    expect(response.report.garage).toEqual(reachable);
  });

  it("Given Postgres is unreachable, When health is reported, Then it answers 503 with the failure", () => {
    const response = healthResponse(
      { reachable: false, error: "connection refused" },
      reachable,
    );

    expect(response.statusCode).toBe(503);
    expect(response.report.status).toBe("unhealthy");
    expect(response.report.postgres).toEqual({
      reachable: false,
      error: "connection refused",
    });
  });

  it("Given Garage is unreachable, When health is reported, Then it answers 503 with the failure", () => {
    const response = healthResponse(reachable, {
      reachable: false,
      error: "no such bucket",
    });

    expect(response.statusCode).toBe(503);
    expect(response.report.garage).toEqual({
      reachable: false,
      error: "no such bucket",
    });
  });

  it("Given a probe throws, When it runs, Then the error becomes an unreachable state", async () => {
    const state = await probe(() => Promise.reject(new Error("unreachable")));

    expect(state).toEqual({ reachable: false, error: "unreachable" });
  });

  it("Given a probe resolves, When it runs, Then it becomes reachable", async () => {
    await expect(probe(() => Promise.resolve())).resolves.toEqual(reachable);
  });
});
