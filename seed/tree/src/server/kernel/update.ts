import { graphEnv } from "../ccgw/env";
import { forwardedCookie } from "../request-context";
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
 * The answer to accepting the update proposal: the bridge keeps a
 * truth-establishing acceptance behind its confirmation origin, so the
 * shell presents the address and never confirms (`BO_0103_003`).
 */
export interface Acceptance {
  readonly status: "accepted" | "pending";
  readonly confirmUrl?: string;
  readonly pending?: string;
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
   * Accepts the whole update proposal through the bridge's `accept` verb as
   * the signed-in owner. The kernel parks it behind its confirmation and
   * answers where; a content-only group would execute at once.
   */
  async accept(proposal: string, version: string): Promise<Acceptance> {
    const cookie = forwardedCookie();
    const response = await fetch(`${graphEnv().kernelUrl}/__kernel/review/accept`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
      body: JSON.stringify({ proposal, rationale: `update from the browser: release ${version} accepted` }),
    });
    if (!response.ok) throw await refusalWithCode(response);
    const envelope = (await response.json()) as { status?: string; confirmUrl?: string; pending?: string };
    if (envelope.status === "pending") {
      return {
        status: "pending",
        ...(envelope.confirmUrl === undefined ? {} : { confirmUrl: envelope.confirmUrl }),
        ...(envelope.pending === undefined ? {} : { pending: envelope.pending }),
      };
    }
    return { status: "accepted" };
  },
};
