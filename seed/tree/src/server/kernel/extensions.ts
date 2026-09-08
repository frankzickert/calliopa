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
};
