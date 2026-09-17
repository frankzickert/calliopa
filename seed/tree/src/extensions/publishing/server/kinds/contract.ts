import type { ConfigurationField } from "~/contract";
import type { PartyAuthorization, PartyTest } from "~/server/kernel/client";
import type { Aspect, ContentClass } from "../../lib/content-index";

/**
 * The contract every channel kind implements. PU_0001_003
 *
 * A kind is code: one module per platform or protocol, declared as a typed
 * value against this shape and listed in `registry.ts`. Nothing else in the
 * extension branches on a kind's name.
 *
 * A kind is split where the network is. What it needs (credential, fields,
 * probe), what it offers (slots), what it takes (units) and what it can do
 * (acts) are data; its projection is a pure function over records; only its
 * transport reaches outward, and only through the kernel's brokered request,
 * which adds the credential. The split is in the contract rather than left to
 * each kind, so the ordinary gate proves every mapping and every refusal
 * without an account and without egress.
 */

/** How a kind's credential works. `oauth` arrives with `BO_0252`. */
export const CREDENTIAL_KINDS = ["apiKey", "oauth", "manual"] as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

/** What a kind takes: a whole deliverable, one item out of one, or its own front. */
export const UNITS = ["deliverable", "item", "front"] as const;
export type Unit = (typeof UNITS)[number];

/** What a kind can do at its platform; whichever the platform actually offers. */
export const ACTS = ["publish", "retire", "replace"] as const;
export type Act = (typeof ACTS)[number];

/** One slot a kind fills: a content class with the constraints the platform imposes. */
export interface Slot {
  readonly key: string;
  readonly title: string;
  readonly class: ContentClass;
  readonly required: boolean;
  readonly aspect: Aspect | null;
  readonly formats: readonly string[];
  readonly maxLength: number | null;
  readonly maxCount: number | null;
  readonly maxDurationSeconds: number | null;
}

/**
 * A kind's offer: fixed in code for a platform, or read from the destination
 * for a website that declares its own index.
 */
export type Offer = { readonly fixed: readonly Slot[] } | { readonly fromDestination: true };

export interface Refusal {
  readonly rule: string;
  readonly detail: string;
}

/** Collects refusals so a projection reports all of them at once. */
export class Refusals {
  private readonly found: Refusal[] = [];

  refuse(rule: string, detail: string): void {
    this.found.push({ rule, detail });
  }

  require(condition: boolean, rule: string, detail: string): void {
    if (!condition) this.refuse(rule, detail);
  }

  get refusals(): readonly Refusal[] {
    return this.found;
  }

  get any(): boolean {
    return this.found.length > 0;
  }
}

export type Projected<T> =
  | { readonly ok: true; readonly document: T }
  | { readonly ok: false; readonly refusals: readonly Refusal[] };

/**
 * One request the transport sends: the kernel resolves the address from the
 * party's configuration, adds the credential and forwards it. What comes back
 * is the destination's own status and body, verbatim.
 */
export interface Transport {
  readonly send: (
    party: string,
    input: {
      readonly method: string;
      /** Under the address's own path, unless `hostPath` says the site answered it absolute on its host. */
      readonly path: string;
      readonly hostPath?: boolean;
      readonly body?: unknown;
      readonly bytes?: Uint8Array;
      readonly contentType?: string;
    },
  ) => Promise<{ readonly status: number; readonly text: string }>;
}

export interface Kind {
  readonly id: string;
  readonly label: string;
  readonly purpose: string;
  readonly credential: CredentialKind;
  /** The configuration fields beside the credential, each with its check. */
  readonly fields: readonly ConfigurationField[];
  /** How the credential is presented, and the probe that proves the pair. */
  readonly authorization: PartyAuthorization;
  readonly probe: PartyTest;
  /** An oauth kind's authorization server; the device flow the kernel runs. BO_0252 */
  readonly provider?: { readonly deviceAuthorizationUrl: string; readonly tokenUrl: string; readonly scopes: readonly string[] };
  /** The path prefixes on the address's host the kind's requests use; absent means the address's own path. */
  readonly paths?: readonly string[];
  /** Configuration the kind fixes rather than the reader types — a platform's API address. */
  readonly fixed?: Readonly<Record<string, string>>;
  readonly offer: Offer;
  readonly units: readonly Unit[];
  readonly acts: readonly Act[];
  /**
   * The publish half, present once a kind can publish: the pure projection
   * from a submission onto the platform's document, and the delivery through
   * the transport. A kind without it is one whose first publish has not been
   * built; the registry says so rather than pretending.
   */
  readonly publish?: {
    readonly project: (submission: unknown) => Projected<unknown>;
    readonly deliver: (transport: Transport, party: string, document: unknown) => Promise<unknown>;
  };
}
