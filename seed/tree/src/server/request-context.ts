import { port } from "./port";

/**
 * What the request the server is answering carried, for the calls the server
 * makes on its behalf: the session cookie the kernel set, which the bridge
 * verbs resolve the person from (`ui-kernel.md`, `BO_0208_007`), and the host
 * the browser reached Calliopa at, which a confirmation link the kernel parks
 * must name (`BO_0241_003`). Carried in the port's request scope so no module
 * threads it by hand; a call outside a request — the behavior suites — reads
 * `CALLIOPA_KERNEL_SESSION` instead, which the kernel harness sets after
 * signing a test human in: the whole cookie pair, since the kernel names its
 * session cookie for its own instance (`ui-kernel.md`, `BO_0307_002`), and
 * the shell never needs to know that name. BO_0307_004
 */
interface RequestContext {
  readonly cookie: string;
  readonly host: string;
  /** The run's grant a tool's callback answers under. BO_0312_063 */
  readonly grant?: string;
}

const storage = port.scope<RequestContext>();

export function withRequestContext<T>(cookie: string, run: () => Promise<T>, host = ""): Promise<T> {
  return storage.run({ cookie, host }, run);
}

/**
 * Answers a run's tool under the grant the kernel handed it. A tool's
 * callback holds no person's session, so the kernel calls it makes present
 * the grant instead, which the prod gate admits where the grant's extension
 * may reach (`calliopa-bootstrap`'s `BO_0312_063`, `BO_0276_001`).
 */
export function withRunGrant<T>(grant: string, run: () => Promise<T>): Promise<T> {
  return storage.run({ cookie: "", host: "", grant }, run);
}

/** The run's grant in force, or `undefined` outside a tool. */
export function forwardedGrant(): string | undefined {
  const grant = storage.current()?.grant;
  return grant === undefined || grant === "" ? undefined : grant;
}

/** The `Cookie` header to forward to the kernel, or `undefined`. */
export function forwardedCookie(): string | undefined {
  const cookie = storage.current()?.cookie;
  if (cookie !== undefined && cookie !== "") return cookie;
  const session = port.env("CALLIOPA_KERNEL_SESSION");
  return session === undefined || session === "" ? undefined : session;
}

/** The host the browser reached Calliopa at, or `undefined` outside a request. */
export function forwardedHost(): string | undefined {
  const host = storage.current()?.host;
  return host === undefined || host === "" ? undefined : host;
}

/**
 * The headers a review call on the browser's behalf carries: its session
 * cookie, and its host as `X-Forwarded-Host`, which the kernel believes from
 * its own served tree only and names the confirmation link after. BO_0241_006
 */
export function forwardedHeaders(): Record<string, string> {
  const cookie = forwardedCookie();
  const host = forwardedHost();
  return {
    ...(cookie === undefined ? {} : { cookie }),
    ...(host === undefined ? {} : { "x-forwarded-host": host }),
  };
}
