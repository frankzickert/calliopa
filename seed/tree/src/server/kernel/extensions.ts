import { graphEnv } from "../ccgw/env";
import { forwardedCookie } from "../request-context";
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
  async setActive(id: string, active: boolean): Promise<ExtensionChange> {
    return answered<ExtensionChange>(
      await call(
        `/__kernel/extensions/${encodeURIComponent(id)}/state`,
        jsonInit("POST", { active }),
      ),
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
    const cookie = forwardedCookie();
    const response = await fetch(`${graphEnv().kernelUrl}/__kernel/review/${verb}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
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
