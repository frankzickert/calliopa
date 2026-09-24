import { timingSafeEqual } from "node:crypto";

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
  const left = Buffer.from(presented);
  const right = Buffer.from(secret);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return "only the kernel calls this route";
  return null;
}
