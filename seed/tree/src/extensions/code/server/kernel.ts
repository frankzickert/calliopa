import { call, refusalWithCode } from "~/server/kernel/client";
import { HttpError } from "~/server/http-error";

import type { RuntimeListing, RuntimeRecord } from "../lib/types";

/**
 * The kernel's code surface, as this extension's server half calls it with
 * the person's session (`BO_0289_019`): every runtime and session read and
 * write goes to `/__kernel/code/…`, which holds the service's bearer and
 * answers the owner's routes for the owner alone. A kernel that serves no
 * code surface answers 404, which the listing says as unreachable rather
 * than failing the page.
 */
export async function kernelJSON<T>(path: string, init: RequestInit): Promise<T> {
  const answer = await call(path, init);
  if (!answer.ok) throw await refusalWithCode(answer);
  return (await answer.json()) as T;
}

export async function listRuntimes(): Promise<RuntimeListing> {
  try {
    const [listed, session] = await Promise.all([
      kernelJSON<{ runtimes: RuntimeRecord[] }>("/__kernel/code/runtimes", { method: "GET" }),
      kernelJSON<{ owner?: boolean }>("/__kernel/session", { method: "GET" }),
    ]);
    return { reachable: true, owner: session.owner === true, runtimes: listed.runtimes ?? [] };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return { reachable: false, owner: false, runtimes: [], refusal: "This instance runs no code service." };
    }
    if (error instanceof HttpError) {
      return { reachable: false, owner: false, runtimes: [], refusal: error.message };
    }
    throw error;
  }
}
