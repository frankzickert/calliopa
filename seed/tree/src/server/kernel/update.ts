import { call, jsonInit, refusalWithCode } from "./client";

/**
 * The update, as the kernel answers it to the owner on its reserved update
 * routes (`ui-kernel.md`, Update From The Browser): the installed release,
 * the served pin, whether the browser's release check is on, what the
 * host-side updater is doing, the update proposal the install staged, and
 * the promotion the owner started. Every call goes as the signed-in person
 * and the kernel refuses anyone but the owner with `forbidden`, passed
 * through with its code. Nothing is decided here and nothing is cached: the
 * updater's status is read on every call. BO_0223_014
 */

export interface UpdaterStatus {
  /** `absent` is the kernel's word for no updater on the host. */
  readonly state: "absent" | "idle" | "running" | "failed";
  readonly heartbeat?: string;
  readonly since?: string;
  readonly version?: string;
  readonly step?: "fetch" | "checkout" | "install" | string;
  readonly log?: readonly string[];
  readonly exit?: string;
}

export interface PendingUpdate {
  readonly proposal: string;
  readonly version: string;
}

export interface UpdatePromotion {
  readonly status: "running" | "promoted" | "refused";
  readonly pin: number;
  readonly reason?: string;
  readonly detail?: string;
  readonly by?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export interface UpdateView {
  /** The release the images were built from; empty when the kernel was not told. */
  readonly release: string;
  readonly servedPin?: number;
  readonly updateCheck: boolean;
  readonly updater: UpdaterStatus;
  readonly pending: PendingUpdate | null;
  readonly promotion?: UpdatePromotion;
}

export interface UpdateRequest {
  readonly version: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
}

export interface ProposalFile {
  readonly path: string;
  readonly change: "added" | "removed" | "modified";
}

export interface UpdateProposal {
  readonly proposal: string;
  readonly version: string;
  readonly head: number;
  readonly files: readonly ProposalFile[];
}

/**
 * The answer to accepting the update proposal. The owner's press is the
 * acceptance: the kernel accepts the update it recorded, staged wholly by
 * the owner, with no confirmation page (`ui-kernel.md`, `BO_0241_002`).
 */
export interface Acceptance {
  readonly status: "accepted";
}

async function answered<T>(response: Response): Promise<T> {
  if (!response.ok) throw await refusalWithCode(response);
  return (await response.json()) as T;
}

export const kernelUpdate = {
  async read(): Promise<UpdateView> {
    return answered<UpdateView>(await call("/__kernel/update", { method: "GET" }));
  },
  async proposal(): Promise<UpdateProposal> {
    return answered<UpdateProposal>(await call("/__kernel/update/proposal", { method: "GET" }));
  },
  async start(version: string): Promise<UpdateRequest> {
    return answered<UpdateRequest>(await call("/__kernel/update", jsonInit("POST", { version })));
  },
  async promote(): Promise<{ readonly promotion: UpdatePromotion }> {
    return answered(await call("/__kernel/update/promote", { method: "POST" }));
  },
  /**
   * Accepts the pending update as the signed-in owner. No proposal is named:
   * the kernel takes the one it recorded, and refuses one another principal
   * staged into (`409 update_not_the_owners`). BO_0241_006
   */
  async accept(): Promise<Acceptance> {
    await answered<unknown>(await call("/__kernel/update/accept", { method: "POST" }));
    return { status: "accepted" };
  },
};
