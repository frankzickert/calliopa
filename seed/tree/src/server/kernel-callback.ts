import type { RunScope } from "./ccgw/branch-scope";
import { port } from "./port";

/**
 * The kernel's calls into an extension's routes (`BO_0264_002`): a route an
 * extension marks `kernelCallback` — a trigger, a context, a tool — answers
 * only a request carrying the secret the kernel generated at its start and
 * handed this process as `CALLIOPA_KERNEL_CALLBACK_SECRET`. The kernel strips
 * the header from every browser request it forwards, so no browser reaches
 * one; a process started without the secret answers none.
 */
export const KERNEL_CALLBACK_HEADER = "x-calliopa-kernel-callback";

/** Why a request is not the kernel's call, or null when it is. Pure. */
export function kernelCallbackRefusal(presented: string | null, secret: string | undefined): string | null {
  if (secret === undefined || secret === "") return "this process was started without a kernel callback secret, so it answers no kernel callback";
  if (presented === null || presented === "") return "only the kernel calls this route";
  if (!port.sameSecret(presented, secret)) return "only the kernel calls this route";
  return null;
}

/** The run a callback is made for, as the kernel names it (`calliopa-bootstrap`'s `BO_0344_001`). */
export const RUN_PIN_HEADER = "x-calliopa-run-pin";
export const RUN_OVERLAY_HEADER = "x-calliopa-run-overlay";

/**
 * The read scope a kernel callback carries: the run's pin, and its group once
 * it has staged; undefined for a callback no run makes. Read only after the
 * secret is checked, so no browser sets it. Pure. BO_0344_004
 */
export function runScopeOf(headers: Headers): RunScope | undefined {
  const pin = Number(headers.get(RUN_PIN_HEADER) ?? "");
  if (!Number.isSafeInteger(pin) || pin <= 0) return undefined;
  const overlay = (headers.get(RUN_OVERLAY_HEADER) ?? "").trim();
  return overlay === "" ? { pin } : { pin, overlay };
}
