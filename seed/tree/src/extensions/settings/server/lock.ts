import { HttpError } from "~/server/http-error";
import { kernelState } from "~/server/kernel/client";
import { port } from "~/server/port";

/**
 * The app lock (`BO_0319_048`): on a device, a setting of the owner's, off
 * until they turn it on, kept in the kernel's settings record under this
 * extension's id — the kernel refuses anyone but the owner a write. While it
 * is on, the app asks for the device's biometrics or passcode when it opens
 * and when it comes back from the background (`adapters/device/entry.ts`). It
 * is turned on only once the person has unlocked with it, so no one locks
 * themselves out with a lock the device cannot open. An instance has no lock:
 * it answers none.
 */

const RECORD = "settings";

/** The reason the device's prompt gives. */
export const UNLOCK_REASON = "Unlock Calliopa";

interface Settings {
  readonly id: string;
  readonly lock?: boolean;
}

export interface LockState {
  /** Whether the app asks on opening. */
  readonly on: boolean;
  /** Whether the device has biometrics or a passcode to ask with. */
  readonly available: boolean;
}

const device = () => {
  if (port.device === undefined) throw new HttpError(404, "An instance has no app lock: it is a device's.", "device_only");
  return port.device;
};

async function stored(): Promise<boolean> {
  return (await kernelState.read<Settings>("settings", RECORD))?.lock === true;
}

export async function lockState(): Promise<LockState> {
  const { lock } = device();
  const [on, available] = await Promise.all([stored(), lock.availability()]);
  return { on, available };
}

/** Whether the app asks on opening; reading it never asks the person. */
export async function lockOn(): Promise<boolean> {
  return port.device !== undefined && (await stored());
}

export async function setLock(on: boolean): Promise<LockState> {
  const { lock } = device();
  if (on) {
    if (!(await lock.availability())) {
      throw new HttpError(409, "This device has no biometrics or passcode set up, so it cannot lock the app.", "lock_unavailable");
    }
    if (!(await lock.authenticate(UNLOCK_REASON))) {
      throw new HttpError(409, "The lock stays off: the device did not confirm it is you.", "lock_not_confirmed");
    }
  }
  const record = (await kernelState.read<Settings>("settings", RECORD)) ?? { id: RECORD };
  await kernelState.write("settings", { ...record, id: RECORD, lock: on });
  return lockState();
}
