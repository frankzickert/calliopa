import { call, jsonInit, refusalWithCode } from "./client";

/**
 * The people who hold authority in this instance, as the kernel answers them
 * on its reserved account routes (`ui-kernel.md`, Account Routes And The
 * Anonymous Gate). Every call goes as the signed-in person — the cookie rides
 * with it — and the core decides: a non-owner listing or creating is answered
 * `forbidden`, a second authority-holding human without a licence
 * `unlicensed`, each passed through with its code so the surface shows the
 * refusal as what it is. Nothing is decided here and nothing is cached: the
 * list is the thing that says who may write, and a copy of it is stale.
 * BO_0209_004
 */

export interface AccountView {
  readonly name: string;
  readonly kind: string;
  readonly class: string;
  readonly state: string;
  readonly owner: boolean;
  readonly demotedByExpiry?: boolean;
  /** When the credential last resolved; absent for one never used. */
  readonly lastUsedAt?: string;
  /** The newest activity among the account's live sessions; absent without one. */
  readonly lastActiveAt?: string;
}

export interface AccountListing {
  readonly principals: readonly AccountView[];
  readonly activeHumans: number;
  readonly seats: number;
  readonly unlimited: boolean;
  readonly authEpoch?: number;
}

/** The core's licence view as the kernel passes it through (`ccgw.md` §14). */
export interface LicenceView {
  readonly state: {
    readonly installed: boolean;
    readonly licensed: boolean;
    readonly seats: string;
    readonly expires?: string;
    readonly daysLeft: number;
    readonly expired: boolean;
    readonly inGrace: boolean;
    readonly lapsed: boolean;
    readonly warning?: string;
  };
  readonly licence?: {
    readonly key: string;
    readonly licensee: string;
    readonly instances: number;
    readonly entitlements: readonly string[];
    readonly issued: string;
    readonly expires: string;
  };
  readonly installedAt?: string;
  readonly installedBy?: string;
}

async function answered<T>(response: Response): Promise<T> {
  if (!response.ok) throw await refusalWithCode(response);
  return (await response.json()) as T;
}

const principalOf = (body: { principal: AccountView }): AccountView => body.principal;

export const kernelAccounts = {
  async list(): Promise<AccountListing> {
    return answered<AccountListing>(await call("/__kernel/accounts", { method: "GET" }));
  },
  async create(input: { name: string; class: string; password: string }): Promise<AccountView> {
    return principalOf(await answered(await call("/__kernel/accounts", jsonInit("POST", input))));
  },
  async setState(name: string, state: string): Promise<AccountView> {
    return principalOf(
      await answered(await call(`/__kernel/accounts/${encodeURIComponent(name)}/state`, jsonInit("POST", { state }))),
    );
  },
  async setClass(name: string, cls: string): Promise<AccountView> {
    return principalOf(
      await answered(await call(`/__kernel/accounts/${encodeURIComponent(name)}/class`, jsonInit("POST", { class: cls }))),
    );
  },
  /**
   * The owner sets anyone's without the current password; a person sets their
   * own with it, and every other session of theirs is revoked on the way.
   */
  async setPassword(
    name: string,
    password: string,
    currentPassword?: string,
  ): Promise<{ readonly otherSessionsRevoked: number }> {
    return answered(
      await call(
        `/__kernel/accounts/${encodeURIComponent(name)}/password`,
        jsonInit("POST", currentPassword === undefined ? { password } : { password, currentPassword }),
      ),
    );
  },
  async licence(): Promise<LicenceView> {
    return answered<LicenceView>(await call("/__kernel/licence", { method: "GET" }));
  },
};
