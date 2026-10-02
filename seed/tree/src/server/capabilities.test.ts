import { describe, expect, it } from "vitest";

import { stateOf } from "./capabilities";

/**
 * A capability's state, from where the shell runs, its key and the network
 * (`docs/system/foundation/device.md`, Capability States). BO_0319_043
 */
describe("a capability's state", () => {
  const keyed = { key: "search", onDevice: null };
  const later = { key: "anthropic", onDevice: "Agent runs come with a later version of the app." };
  const open = { key: null, onDevice: null };

  it("Given an instance, Then everything the stack serves is ready, whatever the key or the network", () => {
    expect(stateOf(later, "instance", false, false)).toEqual({ state: "ready", reason: null, fix: null });
    expect(stateOf(keyed, "instance", false, false).state).toBe("ready");
  });

  it("Given a device that cannot do it at all, Then it is unavailable and says why, before any key", () => {
    expect(stateOf(later, "device", false, true)).toEqual({ state: "unavailable", reason: "Agent runs come with a later version of the app.", fix: null });
    expect(stateOf(later, "device", true, true).state).toBe("unavailable");
  });

  it("Given a device without the key it needs, Then it needs a key and names the connection", () => {
    expect(stateOf(keyed, "device", false, true)).toEqual({ state: "needsKey", reason: "This needs a key, entered in Settings.", fix: "search" });
    expect(stateOf(keyed, "device", false, false).state).toBe("needsKey");
  });

  it("Given a device offline, Then what needs the network is offline; online with its key it is ready", () => {
    expect(stateOf(open, "device", false, false)).toEqual({ state: "offline", reason: "This needs the network, and the device is offline.", fix: null });
    expect(stateOf(keyed, "device", true, false).state).toBe("offline");
    expect(stateOf(keyed, "device", true, true)).toEqual({ state: "ready", reason: null, fix: null });
    expect(stateOf(open, "device", false, true).state).toBe("ready");
  });
});
