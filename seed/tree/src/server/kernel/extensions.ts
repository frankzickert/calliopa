import { graphEnv } from "../ccgw/env";
import { forwardedHeaders } from "../request-context";
import type { ImportRecord } from "~/lib/extension-import";
import { call, jsonInit, refusalWithCode } from "./client";

/**
 * How the graph's extensions are served, as the kernel answers it on its
 * reserved extension routes (`ui-kernel.md`, `BO_0218_005`, `BO_0219_004`):
 * whether each is active, required, pinned to one of its versions, and the
 * versions the graph's history holds. Every call goes as the signed-in
 * person — the cookie rides with it — and the kernel decides: an agent-class
 * person reads and may change nothing, a required extension refuses to be
 * switched off, a dependent or a range refuses a change by name. A change
 * writes the state and promotes head after the answer; the listing reports
 * how the promotion went. Nothing is decided here and nothing is cached.
 *
 * Under `BO_0224` the kernel also creates an extension as truth, exports one
 * as an archive, stages an import as a proposal for the owner alone, answers
 * a staged import again, and promotes head after an accepted update
 * (`ui-kernel.md`, `BO_0224_001`–`BO_0224_004`). BO_0224_009 BO_0224_010
 * BO_0224_011
 */

export interface KernelVersionEntry {
  readonly label: string;
  readonly revision: number;
  readonly introduced: number;
  readonly introducedBy?: string;
  readonly introducedAt?: number;
  readonly rationale?: string;
  readonly current: boolean;
}

export interface KernelExtensionView {
  readonly id: string;
  readonly version: string;
  readonly category: string;
  readonly active: boolean;
  readonly required: boolean;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly dependents: readonly string[];
  readonly pinned: boolean;
  readonly pin?: number;
  readonly servedRevision?: number;
  readonly servedVersion?: string;
  readonly versions: readonly KernelVersionEntry[];
}

export interface KernelPromotion {
  readonly status: "running" | "promoted" | "refused";
  readonly reason: string;
  readonly pin?: number;
  readonly detail?: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly by: string;
}

export interface KernelExtensionListing {
  readonly extensions: readonly KernelExtensionView[];
  readonly required: readonly string[];
  readonly head: number;
  readonly servedPin?: number;
  readonly stateWrittenAt?: number;
  readonly promotion?: KernelPromotion;
  readonly canChange: boolean;
}

/** One extension as `GET /__kernel/extensions/{id}` answers it. BO_0257_009 */
export interface KernelExtensionOne extends Omit<KernelExtensionListing, "extensions"> {
  readonly extension: KernelExtensionView;
  /** Whether the owner allowed it to start runs on its own, whether it
   * declares a trigger that would, and whether the reader is the owner.
   * BO_0264_018 */
  readonly autonomous?: boolean;
  readonly declaresTrigger?: boolean;
  readonly isOwner?: boolean;
}

/** The answer to a create: the new extension's view and the revision it was established at. */
export interface ExtensionCreated {
  readonly extension: KernelExtensionView;
  readonly dataRevision: number;
  readonly head: number;
}

/** An export as the kernel streams it: the zip's bytes and the file name it named. */
export interface ExtensionArchive {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/**
 * The answer to accepting or rejecting an import's group through the
 * bridge: a truth-establishing acceptance is parked behind the kernel's
 * confirmation origin, so the shell presents the address and never confirms
 * (`BO_0103_003`); a rejection executes at once.
 */
export interface ImportDecision {
  readonly status: "accepted" | "rejected" | "pending";
  readonly confirmUrl?: string;
  readonly pending?: string;
}

export interface KernelHealth {
  readonly mode: string;
  readonly state: string;
  readonly pin?: number;
  readonly detail?: string;
  readonly extensionTruth?: number;
}

export interface ExtensionChange {
  readonly id: string;
  readonly changed: boolean;
  readonly active?: boolean;
  readonly pinned?: boolean;
  readonly pin?: number;
  readonly version?: string;
  readonly stateWrittenAt?: number;
  readonly promotion?: KernelPromotion;
}

/**
 * What a staged group is judged by, as `GET /__kernel/extensions/{id}/groups`
 * answers it (`ui-kernel.md`, `BO_0282_004`). A person does not read code to
 * judge a change, so this is what stands in its place: the change document
 * and the status its staged line reads, what the group touches, the runs that
 * staged into it with their gates, and — for one group — how many files it
 * adds, changes and removes. There is no diff here and there is meant to be
 * none.
 */
export interface KernelGroupRun {
  readonly id: string;
  readonly goal?: string;
  readonly person?: string;
  readonly agent?: string;
  readonly executedBy?: string;
  readonly model?: string;
  readonly status?: string;
  readonly conclusion?: string;
  readonly buildOk: boolean;
  readonly checkOk: boolean;
  readonly testOk: boolean;
}

export interface KernelGroup {
  readonly group: string;
  readonly status: string;
  readonly createdBy: string;
  readonly rationale?: string;
  readonly change?: string;
  readonly changeStatus?: string;
  /** Set when the group is a waiting status move. BO_0297_002 */
  readonly statusMove?: { readonly path: string; readonly from: string; readonly to: string };
  readonly members?: Readonly<Record<string, number>>;
  readonly runs?: readonly KernelGroupRun[];
  readonly files?: {
    readonly added: number;
    readonly changed: number;
    readonly removed: number;
  };
}

/** A change document's status move, staged and followed by its confirmation. BO_0282_005 BO_0297_001 */
export interface ChangeStatusOutcome {
  readonly extension: string;
  readonly path: string;
  readonly node?: string;
  readonly from?: string;
  readonly to: string;
  readonly group?: string;
  readonly changed: boolean;
  /** The waiting moves this choice rejected. BO_0297_003 */
  readonly replaced?: readonly string[];
  /** The acceptance asked for at once, and where to confirm it. BO_0297_001 */
  readonly status?: "pending";
  readonly confirmUrl?: string;
}

/** A candidate served beside the instance. BO_0282_003 */
export interface KernelCandidate {
  readonly group: string;
  readonly status: "building" | "serving" | "refused" | "stopped";
  readonly detail?: string;
  readonly address?: string;
  readonly by: string;
  readonly startedAt: string;
  readonly expiresAt?: string;
}

export interface KernelCandidateAnswer {
  readonly running: boolean;
  readonly candidate?: KernelCandidate;
}

async function answered<T>(response: Response): Promise<T> {
  if (!response.ok) throw await refusalWithCode(response);
  return (await response.json()) as T;
}

export const kernelExtensions = {
  async list(): Promise<KernelExtensionListing> {
    return answered<KernelExtensionListing>(
      await call("/__kernel/extensions", { method: "GET" }),
    );
  },
  /** One extension as the listing answers it, read from that extension alone. BO_0257_009 */
  async one(id: string): Promise<KernelExtensionOne> {
    return answered<KernelExtensionOne>(
      await call(`/__kernel/extensions/${encodeURIComponent(id)}`, { method: "GET" }),
    );
  },
  async setActive(id: string, active: boolean): Promise<ExtensionChange> {
    return answered<ExtensionChange>(
      await call(
        `/__kernel/extensions/${encodeURIComponent(id)}/state`,
        jsonInit("POST", { active }),
      ),
    );
  },
  /** Allow an extension to start runs on its own, or withdraw it; the owner's alone. BO_0264_018 */
  async setAutonomous(id: string, allowed: boolean): Promise<{ readonly id: string; readonly allowed: boolean; readonly changed: boolean }> {
    return answered(
      await call(`/__kernel/extensions/${encodeURIComponent(id)}/autonomous`, jsonInit("POST", { allowed })),
    );
  },
  async setVersion(
    id: string,
    choice: { readonly revision: number } | { readonly follow: true },
  ): Promise<ExtensionChange> {
    return answered<ExtensionChange>(
      await call(
        `/__kernel/extensions/${encodeURIComponent(id)}/version`,
        jsonInit("POST", choice),
      ),
    );
  },
  /** The kernel's own state — `building`, `serving` at a pin — for the rebuild the view watches. */
  async health(): Promise<KernelHealth> {
    return answered<KernelHealth>(
      await call("/__kernel/healthz", { method: "GET" }),
    );
  },
  /** The open groups touching this extension's members, with their evidence. BO_0282_004 */
  async groups(id: string): Promise<{ readonly id: string; readonly groups: readonly KernelGroup[] }> {
    return answered(
      await call(`/__kernel/extensions/${encodeURIComponent(id)}/groups`, { method: "GET" }),
    );
  },
  /** One group, which additionally counts the files it touches. BO_0282_004 */
  async group(id: string, group: string): Promise<KernelGroup> {
    return answered<KernelGroup>(
      await call(
        `/__kernel/extensions/${encodeURIComponent(id)}/groups/${encodeURIComponent(group)}`,
        { method: "GET" },
      ),
    );
  },
  /** Stage a change document's status move; acceptance establishes it. BO_0282_005 */
  async setChangeStatus(id: string, path: string, status: string): Promise<ChangeStatusOutcome> {
    return answered<ChangeStatusOutcome>(
      await call(
        `/__kernel/extensions/${encodeURIComponent(id)}/change-status`,
        jsonInit("POST", { path, status }),
      ),
    );
  },
  /** The candidate served beside the instance, if one is. BO_0282_003 */
  async candidate(): Promise<KernelCandidateAnswer> {
    return answered<KernelCandidateAnswer>(
      await call("/__kernel/preview/candidates", { method: "GET" }),
    );
  },
  /** Build and serve a staged group beside the instance. BO_0282_003 */
  async startCandidate(group: string): Promise<KernelCandidateAnswer> {
    return answered<KernelCandidateAnswer>(
      await call("/__kernel/preview/candidates", jsonInit("POST", { group })),
    );
  },
  /** Stop the candidate; the instance is untouched either way. BO_0282_003 */
  async stopCandidate(): Promise<KernelCandidateAnswer> {
    return answered<KernelCandidateAnswer>(
      await call("/__kernel/preview/candidates", { method: "DELETE" }),
    );
  },
  /** A new extension as truth: its manifest and system.md, nothing to serve yet. BO_0224_009 */
  async create(id: string, purpose: string): Promise<ExtensionCreated> {
    return answered<ExtensionCreated>(
      await call("/__kernel/extensions", jsonInit("POST", { id, purpose })),
    );
  },
  /** One extension as an archive, its newest state or one of its versions by revision. BO_0224_010 */
  async exportArchive(id: string, revision?: number): Promise<ExtensionArchive> {
    const query = revision === undefined ? "" : `?revision=${revision}`;
    const response = await call(
      `/__kernel/extensions/${encodeURIComponent(id)}/export${query}`,
      { method: "GET" },
    );
    if (!response.ok) throw await refusalWithCode(response);
    const disposition = response.headers.get("content-disposition") ?? "";
    const named = /filename="([^"]+)"/u.exec(disposition);
    return {
      fileName: named?.[1] ?? `${id}.calliopa-extension.zip`,
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  },
  /** An archive staged as a proposal for the owner: the group and the summary. BO_0224_011 */
  async importArchive(bytes: Uint8Array, name: string): Promise<ImportRecord> {
    return answered<ImportRecord>(
      await call(`/__kernel/extensions/import?name=${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      }),
    );
  },
  /** A staged import again, with its group's state and the last promotion. BO_0224_011 */
  async importRecord(group: string): Promise<ImportRecord> {
    return answered<ImportRecord>(
      await call(`/__kernel/extensions/import/${encodeURIComponent(group)}`, { method: "GET" }),
    );
  },
  /** Head promoted through the gate as the signed-in human: an update's Serve now. BO_0224_011 */
  async promote(): Promise<{ readonly promotion: KernelPromotion; readonly head: number }> {
    return answered(await call("/__kernel/extensions/promote", { method: "POST" }));
  },
  /**
   * Accepts or rejects an import's group through the bridge's verbs as the
   * signed-in person. An acceptance of an extension group is parked behind
   * the kernel's confirmation and the address is answered, the way the
   * Update tab receives it (`BO_0223_014`).
   */
  async decide(verb: "accept" | "reject", proposal: string, rationale: string): Promise<ImportDecision> {
    // The browser's host travels with the cookie, so the confirmation link
    // the kernel answers names the address the owner is on. BO_0241_006
    const response = await fetch(`${graphEnv().kernelUrl}/__kernel/review/${verb}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...forwardedHeaders() },
      body: JSON.stringify({ proposal, rationale }),
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
    return { status: verb === "accept" ? "accepted" : "rejected" };
  },
};
