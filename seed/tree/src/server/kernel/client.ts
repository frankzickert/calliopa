import { graphEnv } from "../ccgw/env";
import { HttpError } from "../http-error";
import { forwardedCookie } from "../request-context";

/**
 * The shell's side of the kernel's two stores for what is not content: the
 * per-instance state record — workspaces and processes — and the secret store
 * for the parties the shell presents credentials to (`ui-kernel.md`,
 * `BO_0207_002`, `BO_0207_003`).
 *
 * Both live on the kernel's volumes behind kernel endpoints. The state record
 * because a tab switch is not a fact about the product and should not be a
 * data revision; the secret store because no shell code may hold a plaintext
 * secret: the kernel runs the connection tests and brokers every outbound
 * request that needs a credential. The kernel hands the tree its own address
 * (`CALLIOPA_KERNEL_URL`), and the shell's server side passes the bridge's
 * same-origin rule as the non-browser caller it is.
 *
 * Every call forwards the browser's session cookie, as the bridge's do: a
 * served page reads the kernel as the person whose browser asked for it, and
 * in prod the kernel's public port admits nobody else (`ui-kernel.md`,
 * `BO_0214_009`). BO_0209_002
 */

interface Refusal {
  readonly status?: string;
  readonly diagnostics?: readonly { readonly code: string; readonly message: string }[];
  readonly detail?: string;
}

export async function call(path: string, init: RequestInit): Promise<Response> {
  const cookie = forwardedCookie();
  const headers = new Headers(init.headers);
  if (cookie !== undefined && !headers.has("cookie")) headers.set("cookie", cookie);
  try {
    return await fetch(`${graphEnv().kernelUrl}${path}`, { ...init, headers });
  } catch (error) {
    throw new HttpError(503, `the kernel is unreachable: ${String(error)}`);
  }
}

async function refusalOf(response: Response): Promise<HttpError> {
  const text = await response.text();
  let refusal: Refusal = {};
  try {
    refusal = text === "" ? {} : (JSON.parse(text) as Refusal);
  } catch {
    refusal = { detail: text };
  }
  const message =
    refusal.diagnostics?.map((d) => d.message).join("; ") ??
    refusal.detail ??
    `the kernel answered ${response.status}`;
  // The kernel's code rides along — `sign_in_required` is what a page loader
  // turns into the sign-in redirect. BO_0209_003
  return new HttpError(
    response.status === 404 ? 404 : response.status >= 500 ? 503 : 400,
    message,
    refusal.diagnostics?.[0]?.code,
  );
}

/**
 * The kernel's refusal with its status and code kept, for a surface that
 * shows a refusal as what it is — `unlicensed`, `forbidden`,
 * `sign_in_required` — rather than as a generic failure. BO_0209_004
 */
export async function refusalWithCode(response: Response): Promise<HttpError> {
  const text = await response.text();
  let refusal: Refusal = {};
  try {
    refusal = text === "" ? {} : (JSON.parse(text) as Refusal);
  } catch {
    refusal = { detail: text };
  }
  const first = refusal.diagnostics?.[0];
  const message = first?.message ?? refusal.detail ?? `the kernel answered ${response.status}`;
  return new HttpError(response.status >= 500 ? 503 : response.status, message, first?.code);
}

export const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export type StateCollection = "workspaces" | "processes";

/** The per-instance state record: one JSON object per id. */
export const kernelState = {
  async list(collection: StateCollection): Promise<string[]> {
    const response = await call(`/__kernel/state/${collection}`, { method: "GET" });
    if (!response.ok) throw await refusalOf(response);
    const body = (await response.json()) as { ids?: string[] };
    return body.ids ?? [];
  },
  async read<T>(collection: StateCollection, id: string): Promise<T | null> {
    const response = await call(`/__kernel/state/${collection}/${encodeURIComponent(id)}`, { method: "GET" });
    if (response.status === 404) return null;
    if (!response.ok) throw await refusalOf(response);
    return (await response.json()) as T;
  },
  async write<T extends { readonly id: string }>(collection: StateCollection, record: T): Promise<T> {
    const response = await call(`/__kernel/state/${collection}/${encodeURIComponent(record.id)}`, jsonInit("PUT", record));
    if (!response.ok) throw await refusalOf(response);
    return record;
  },
  async remove(collection: StateCollection, id: string): Promise<void> {
    const response = await call(`/__kernel/state/${collection}/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) throw await refusalOf(response);
  },
};

export interface PartyAuthorization {
  readonly header?: string;
  readonly scheme?: string;
  readonly secretField: string;
}

export interface PartyTest {
  readonly method?: string;
  readonly url: string;
  readonly expectStatus?: number;
}

/** What the kernel answers about a party: everything but the values. */
export interface PartyView {
  readonly party: string;
  readonly kind?: string;
  readonly configuration: Readonly<Record<string, string>>;
  readonly secretFields: Readonly<Record<string, { readonly set: boolean; readonly suffix?: string }>>;
  readonly authorization?: PartyAuthorization;
  readonly test?: PartyTest;
  readonly state: string;
  readonly lastTestedAt?: string;
  readonly lastError?: string;
  readonly updatedAt?: string;
}

export interface PartyChange {
  readonly kind?: string;
  readonly configuration?: Readonly<Record<string, string | null>>;
  readonly secrets?: Readonly<Record<string, string | null>>;
  readonly authorization?: PartyAuthorization;
  readonly test?: PartyTest;
}

export interface PartyTestOutcome {
  readonly party: string;
  readonly pass: boolean;
  readonly status: number;
  readonly reason: string;
  readonly state: string;
}

/** The secret store. No call here ever answers a secret value. */
export const kernelSecrets = {
  async read(party: string): Promise<PartyView> {
    const response = await call(`/__kernel/secrets/parties/${party}`, { method: "GET" });
    if (!response.ok) throw await refusalOf(response);
    return (await response.json()) as PartyView;
  },
  async write(party: string, change: PartyChange): Promise<PartyView> {
    const response = await call(`/__kernel/secrets/parties/${party}`, jsonInit("PUT", change));
    if (!response.ok) throw await refusalOf(response);
    return (await response.json()) as PartyView;
  },
  async remove(party: string): Promise<void> {
    const response = await call(`/__kernel/secrets/parties/${party}`, { method: "DELETE" });
    if (!response.ok) throw await refusalOf(response);
  },
  async test(party: string): Promise<PartyTestOutcome> {
    const response = await call(`/__kernel/secrets/parties/${party}/test`, { method: "POST" });
    if (!response.ok) throw await refusalOf(response);
    return (await response.json()) as PartyTestOutcome;
  },
  /**
   * One outbound request to the party, brokered: the kernel resolves the
   * address, adds the credential and forwards. The destination's status and
   * body come back verbatim; a kernel refusal carries no party status header
   * and is thrown instead.
   */
  async request(
    party: string,
    input: {
      readonly method: string;
      readonly path: string;
      readonly body?: unknown;
      readonly bytes?: Uint8Array;
      readonly contentType?: string;
    },
  ): Promise<{ readonly status: number; readonly text: string }> {
    const response = await call(
      `/__kernel/secrets/parties/${party}/request`,
      jsonInit("POST", {
        method: input.method,
        path: input.path,
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.bytes === undefined ? {} : { bytesBase64: Buffer.from(input.bytes).toString("base64") }),
        ...(input.contentType === undefined ? {} : { contentType: input.contentType }),
      }),
    );
    if (response.headers.get("x-calliopa-party-status") === null) {
      throw await refusalOf(response);
    }
    return { status: response.status, text: await response.text() };
  },
};
