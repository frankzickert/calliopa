import { AsyncLocalStorage } from "node:async_hooks";

/**
 * What the request the server is answering carried, for the calls the server
 * makes on its behalf: the session cookie the kernel set, which the bridge
 * verbs resolve the person from (`ui-kernel.md`, `BO_0208_007`), and the host
 * the browser reached Calliopa at, which a confirmation link the kernel parks
 * must name (`BO_0241_003`). Carried in async-local storage so no module
 * threads it by hand; a call outside a request — the behavior suites — reads
 * `CALLIOPA_KERNEL_SESSION` instead, which the kernel harness sets after
 * signing a test human in.
 */
interface RequestContext {
  readonly cookie: string;
  readonly host: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(cookie: string, run: () => Promise<T>, host = ""): Promise<T> {
  return storage.run({ cookie, host }, run);
}

/** The `Cookie` header to forward to the kernel, or `undefined`. */
export function forwardedCookie(): string | undefined {
  const cookie = storage.getStore()?.cookie;
  if (cookie !== undefined && cookie !== "") return cookie;
  const session = process.env["CALLIOPA_KERNEL_SESSION"];
  return session === undefined || session === "" ? undefined : `calliopa_session=${session}`;
}

/** The host the browser reached Calliopa at, or `undefined` outside a request. */
export function forwardedHost(): string | undefined {
  const host = storage.getStore()?.host;
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
