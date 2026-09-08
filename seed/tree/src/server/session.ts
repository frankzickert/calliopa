import { graphEnv } from "./ccgw/env";
import { forwardedCookie } from "./request-context";

/** Who a request is signed in as: a name and a class, never a credential. */
export interface Person {
  readonly name: string;
  /** `human` may establish truth; `agent` may only propose. */
  readonly class: string;
}

/**
 * The signed-in person, read from the kernel for the request being answered
 * and cached nowhere: the session is kernel-held and the browser carries an
 * opaque reference (`ui-kernel.md`, `BO_0208_005`). `null` without a session,
 * which in prod a served page never is — the gate sent the browser to sign-in
 * first — and in dev is the operator's checkout. BO_0209_003
 */
export async function readSession(): Promise<Person | null> {
  const cookie = forwardedCookie();
  if (cookie === undefined) return null;
  try {
    const response = await fetch(`${graphEnv().kernelUrl}/__kernel/session`, { headers: { cookie } });
    if (!response.ok) return null;
    const body = (await response.json()) as { name?: unknown; class?: unknown };
    if (typeof body.name !== "string" || body.name === "") return null;
    return { name: body.name, class: typeof body.class === "string" ? body.class : "" };
  } catch {
    return null;
  }
}
