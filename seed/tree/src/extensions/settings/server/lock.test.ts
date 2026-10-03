import { describe, expect, it } from "vitest";

import { HttpError } from "~/server/http-error";
import { port } from "~/server/port";
import { lockOn, lockState, setLock } from "./lock";

/**
 * The app lock is a device's: an instance's port carries no device plugins,
 * so it answers no lock, refuses to set one, and never reports one on — the
 * device's entry reads that before it shows anything. BO_0319_048
 */
describe("the app lock on an instance", () => {
  it("Given an instance, Then there is no lock to read, set or find on", async () => {
    expect(port.where).toBe("instance");
    expect(port.device).toBeUndefined();
    for (const call of [() => lockState(), () => setLock(true), () => setLock(false)]) {
      const refused = await call().catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(HttpError);
      expect((refused as HttpError).status).toBe(404);
      expect((refused as HttpError).code).toBe("device_only");
    }
    expect(await lockOn()).toBe(false);
  });
});
